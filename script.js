/* ====================================================
   LINEAR CONCEPTS — script.js
   Framer-aesthetic interactions:
   – Scroll-scrubbed hero frame sequence
   – Frosted-glass nav on scroll
   – Spring reveal (IntersectionObserver)
   – Stat counters
   – Mobile nav toggle
   – Smooth anchor scroll
   ==================================================== */

// ---- CONFIG ----
const FRAME_COUNT   = 60;       // 60 = good balance of smooth + fast
const OUTPUT_WIDTH  = 1280;
const OUTPUT_HEIGHT = 720;
const WEBP_QUALITY  = 0.80;
const SHOW_AFTER    = 1;        // show page after extracting this many frames

// ---- ELEMENTS ----
const videoHero    = document.getElementById('source-video');
const videoProcess = document.getElementById('process-video');

const heroImg      = document.getElementById('hero-frame');
const spacerHero   = document.getElementById('spacer');

const processImg   = document.getElementById('process-frame');
const spacerProcess= document.getElementById('process-spacer');

const overlay      = document.getElementById('loading-overlay');
const percentLabel = document.getElementById('loading-percent');
const barFill      = document.getElementById('loading-bar-fill');
const header       = document.getElementById('site-header');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Allow cross-origin video (required for canvas.toBlob)
if(videoHero) videoHero.crossOrigin = 'anonymous';
if(videoProcess) videoProcess.crossOrigin = 'anonymous';

let blobUrlsHero    = [];
let blobUrlsProcess = [];

let scrollReadyHero    = false;
let scrollReadyProcess = false;

let earlyInitHero   = false;
let motionTicking = false;

/* ============================================================
   LOADING PROGRESS
   ============================================================ */
function setLoadingProgress(pct) {
  percentLabel.textContent = Math.round(pct * 100);
  barFill.style.width = `${pct * 100}%`;
}

/* ============================================================
   FRAME EXTRACTION
   ============================================================ */
function captureFrame(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, 'image/webp', WEBP_QUALITY);
  });
}

async function extractVideoFrames(vidElement, urlsArray, onProgress, onFirstFrame) {
  const canvas = document.createElement('canvas');
  canvas.width  = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext('2d');
  const duration = vidElement.duration;
  let firstFired = false;

  for (let i = 0; i < FRAME_COUNT; i++) {
    let time = (i / (FRAME_COUNT - 1)) * duration;
    if (i === 0) time = 0.001; // avoid stuck seek at 0

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        vidElement.removeEventListener('seeked', onSeeked);
        clearTimeout(tid);
        resolve();
      };
      const onSeeked = () => finish();
      const tid = setTimeout(finish, 2000); // safety net
      vidElement.addEventListener('seeked', onSeeked);
      vidElement.currentTime = time;
    });

    ctx.drawImage(vidElement, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    urlsArray.push(await captureFrame(canvas));
    
    if (onProgress) onProgress((i + 1) / FRAME_COUNT);

    if (!firstFired && urlsArray.length >= SHOW_AFTER) {
      firstFired = true;
      if (onFirstFrame) onFirstFrame();
    }
  }
}

function getScrollProgress(spacerEl) {
  if (!spacerEl) return 0;
  const rect = spacerEl.getBoundingClientRect();
  const scrollable = rect.height - window.innerHeight;
  return Math.min(Math.max(-rect.top / scrollable, 0), 1);
}

function updateFrames() {
  // Update Hero
  if (scrollReadyHero && blobUrlsHero.length > 0) {
    const p = getScrollProgress(spacerHero);
    document.documentElement.style.setProperty('--hero-progress', p.toFixed(3));
    const idx = Math.round(p * (blobUrlsHero.length - 1));
    if (heroImg.src !== blobUrlsHero[idx]) heroImg.src = blobUrlsHero[idx];
  }
  
  // Update Process
  if (scrollReadyProcess && blobUrlsProcess.length > 0) {
    const p = getScrollProgress(spacerProcess);
    const idx = Math.round(p * (blobUrlsProcess.length - 1));
    if (processImg.src !== blobUrlsProcess[idx]) processImg.src = blobUrlsProcess[idx];
    // Zoom effect: scale from 1.0 to 1.25 as user scrolls
    processImg.style.transform = `scale(${1 + (p * 0.25)})`;
  }
}

function initHero() {
  if (scrollReadyHero) return;
  if(blobUrlsHero.length > 0) heroImg.src = blobUrlsHero[0];
  scrollReadyHero = true;
  window.addEventListener('scroll', updateFrames, { passive: true });
  window.addEventListener('resize', updateFrames);
  updateFrames();
  overlay.classList.add('hidden');
  document.body.classList.add('page-ready');
}

function initProcess() {
  if (scrollReadyProcess) return;
  if(blobUrlsProcess.length > 0) processImg.src = blobUrlsProcess[0];
  scrollReadyProcess = true;
  updateFrames();
}

async function handleHeroVideoReady() {
  console.log('[LC] Hero Video ready. Duration:', videoHero.duration);
  try {
    await extractVideoFrames(
      videoHero, 
      blobUrlsHero, 
      setLoadingProgress, 
      () => {
        if (!earlyInitHero) {
          earlyInitHero = true;
          initHero();
        }
      }
    );
    console.log('[LC] Hero frames extracted:', blobUrlsHero.length);
    if (!earlyInitHero) initHero();
    
    // Start processing second video in background
    if(videoProcess && videoProcess.readyState >= 1) {
      handleProcessVideoReady();
    } else if(videoProcess) {
      videoProcess.addEventListener('loadedmetadata', handleProcessVideoReady, { once: true });
    }
  } catch (err) {
    console.error('[LC] Hero extraction failed:', err);
    if (!earlyInitHero && blobUrlsHero.length > 0) initHero();
    overlay.querySelector('.loading-sub').textContent = 'Error loading hero video frames.';
  }
}

async function handleProcessVideoReady() {
  console.log('[LC] Process Video ready. Duration:', videoProcess.duration);
  try {
    await extractVideoFrames(videoProcess, blobUrlsProcess, null, initProcess);
    console.log('[LC] Process frames extracted:', blobUrlsProcess.length);
    initProcess();
  } catch (err) {
    console.error('[LC] Process extraction failed:', err);
    if(blobUrlsProcess.length > 0) initProcess();
  }
}

if(videoHero) {
  videoHero.addEventListener('loadedmetadata', handleHeroVideoReady, { once: true });
  if (videoHero.readyState >= 1) handleHeroVideoReady();
}

if(videoHero) {
  videoHero.addEventListener('error', () => {
    console.error('[LC] Video failed to load.');
    overlay.querySelector('.loading-sub').textContent =
      'Video failed to load. Check assets/hero.mp4.';
  });
  
  setTimeout(() => {
    if (videoHero.readyState === 0) {
      overlay.querySelector('.loading-sub').textContent =
        'Video not loading — serve via a local server, not file://';
    }
  }, 5000);
}

// Auto-dismiss loading overlay after 15s as a last-resort fallback
setTimeout(() => {
  if (!overlay.classList.contains('hidden')) {
    overlay.classList.add('hidden');
    document.body.classList.add('page-ready');
    console.warn('[LC] Loading overlay force-dismissed after 15s');
  }
}, 15000);

// Skip button — dismiss overlay immediately
const skipBtn = document.getElementById('loading-skip');
if (skipBtn) {
  skipBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    document.body.classList.add('page-ready');
    if (!scrollReady && blobUrls.length > 0) init();
  });
}

/* ============================================================
   SITE-WIDE MOTION — Framer-style choreography without a framework
   ============================================================ */
function setupMotionAttributes() {
  document.querySelectorAll('.about-left, .contact-left').forEach((el) => {
    el.setAttribute('data-reveal', 'left');
  });

  document.querySelectorAll('.about-img-wide, .about-img-sm, .services-bg, .marquee-row').forEach((el) => {
    if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', 'zoom');
  });

  document.querySelectorAll('.section-header-right, .services-card, .studio-card, .contact-form').forEach((el) => {
    if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', 'right');
  });

  document.querySelectorAll('.marquee-row').forEach((el, index) => {
    el.dataset.stagger = String(index + 1);
  });

  document.querySelectorAll('.glow-blob, .services-bg-img').forEach((el, index) => {
    el.dataset.parallax = String(index % 2 === 0 ? -0.08 : 0.08);
  });
}

function updateScrollMotion() {
  motionTicking = false;
  const viewportH = window.innerHeight || 1;

  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const speed = parseFloat(el.dataset.parallax || '0');
    const rect = el.getBoundingClientRect();
    const centerDelta = (rect.top + rect.height / 2) - viewportH / 2;
    const y = centerDelta * speed;
    el.style.setProperty('--parallax-y', `${y.toFixed(2)}px`);
    el.style.transform = `translate3d(0, var(--parallax-y), 0)`;
  });
}

function requestScrollMotion() {
  if (motionTicking || prefersReducedMotion) return;
  motionTicking = true;
  requestAnimationFrame(updateScrollMotion);
}

setupMotionAttributes();

if (!prefersReducedMotion) {
  window.addEventListener('scroll', requestScrollMotion, { passive: true });
  window.addEventListener('resize', requestScrollMotion);
  requestScrollMotion();
}

/* ============================================================
   SCROLL REVEAL — IntersectionObserver (Framer-style spring)
   ============================================================ */
const revealEls = document.querySelectorAll('[data-reveal]');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealEls.forEach((el) => revealObserver.observe(el));

/* ============================================================
   STAT COUNTER ANIMATION
   ============================================================ */
const statEls = document.querySelectorAll('[data-count]');

function animateCount(el) {
  if (el.dataset.countAnimated === 'true') return;
  el.dataset.countAnimated = 'true';

  const target   = parseInt(el.dataset.count, 10);
  const duration = 1600;
  const start    = performance.now();

  if (prefersReducedMotion) {
    el.textContent = target.toLocaleString();
    return;
  }

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    el.textContent = Math.round(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const counter = entry.target.matches('[data-count]')
        ? entry.target
        : entry.target.querySelector('[data-count]');
      if (counter) animateCount(counter);
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

statEls.forEach((el) => statObserver.observe(el.closest('.stat') || el));

/* ============================================================
   FROSTED-GLASS NAV ON SCROLL
   ============================================================ */
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}, { passive: true });

/* ============================================================
   MOBILE NAV TOGGLE
   ============================================================ */
const navToggle = document.getElementById('nav-toggle');
const mainNav   = document.getElementById('main-nav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.style.display === 'flex';
    const lines  = navToggle.querySelectorAll('span');

    if (isOpen) {
      mainNav.style.display = '';
      navToggle.setAttribute('aria-expanded', 'false');
      lines[0].style.transform = '';
      lines[1].style.opacity = '';
      lines[2].style.transform = '';
    } else {
      mainNav.style.cssText = `
        display: flex;
        flex-direction: column;
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        background: rgba(245,245,240,0.97);
        backdrop-filter: blur(24px);
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 14px;
        padding: 12px;
        gap: 4px;
        z-index: 1001;
      `;
      navToggle.setAttribute('aria-expanded', 'true');
      lines[0].style.transform = 'translateY(5.5px) rotate(45deg)';
      lines[1].style.opacity = '0';
      lines[2].style.transform = 'translateY(-5.5px) rotate(-45deg)';
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!header.contains(e.target) && mainNav.style.display === 'flex') {
      mainNav.style.display = '';
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.querySelectorAll('span').forEach(s => {
        s.style.transform = '';
        s.style.opacity = '';
      });
    }
  });
}

/* ============================================================
   BACK TO TOP
   ============================================================ */
const backToTop = document.getElementById('back-to-top');
if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  // Show/hide based on scroll position
  window.addEventListener('scroll', () => {
    backToTop.style.opacity = window.scrollY > 400 ? '1' : '0';
    backToTop.style.pointerEvents = window.scrollY > 400 ? 'auto' : 'none';
  }, { passive: true });
  backToTop.style.opacity = '0';
  backToTop.style.transition = 'opacity 0.3s ease, transform 0.3s var(--spring)';
}

/* ============================================================
   SMOOTH ANCHOR SCROLL
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href');
    if (id.length > 1) {
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});

/* ============================================================
   CONTACT FORM — submission feedback
   ============================================================ */
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('.btn-submit');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Sending… ⟳';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    // Simulate send (replace with real endpoint)
    setTimeout(() => {
      btn.innerHTML = 'Sent! ✓';
      btn.style.opacity = '1';
      btn.style.background = '#22c55e';
      btn.style.color = '#fff';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.color = '';
        btn.disabled = false;
        contactForm.reset();
      }, 3000);
    }, 1200);
  });
}

/* ============================================================
   SCROLL HINT — hide after first scroll past hero
   ============================================================ */
const scrollHint = document.getElementById('scroll-hint');
if (scrollHint) {
  let hintHidden = false;
  window.addEventListener('scroll', () => {
    if (!hintHidden && window.scrollY > 80) {
      scrollHint.style.opacity = '0';
      scrollHint.style.transition = 'opacity 0.5s ease';
      hintHidden = true;
    }
  }, { passive: true });
}

/* ============================================================
   PROJECT CARD CAROUSELS
   ============================================================ */
function initCarousels() {
  const carousels = document.querySelectorAll('[data-carousel]');

  carousels.forEach((carousel) => {
    const id      = carousel.dataset.carousel;
    const slides  = Array.from(carousel.querySelectorAll('.card-slide'));
    const card    = carousel.closest('.project-card-img');
    const countEl = card?.querySelector('.card-count');
    const total   = slides.length;
    let current   = 0;

    function goTo(n) {
      slides[current].classList.remove('active');
      current = (n + total) % total;
      slides[current].classList.add('active');
      if (countEl) countEl.textContent = `${current + 1} / ${total}`;
    }

    // Prev / Next buttons
    const prevBtn = card?.querySelector('.carousel-prev[data-target="' + id + '"]');
    const nextBtn = card?.querySelector('.carousel-next[data-target="' + id + '"]');

    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(current + 1); });

    // Keyboard: when card is focused
    card?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
    });

    // Touch swipe
    let touchStartX = 0;
    carousel.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) goTo(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
  });
}

initCarousels();

/* ============================================================
   TEXT REVEAL ANIMATION (About Section)
   ============================================================ */
const scrollRevealSection = document.querySelector('.scroll-reveal-section');
const revealText = document.getElementById('reveal-text');
if (scrollRevealSection && revealText) {
  const childNodes = Array.from(revealText.childNodes);
  revealText.innerHTML = '';
  
  childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const words = node.textContent.split(/\s+/).filter(w => w.trim() !== '');
      words.forEach(word => {
        const span = document.createElement('span');
        span.textContent = word + ' ';
        span.classList.add('reveal-word');
        revealText.appendChild(span);
      });
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
      revealText.appendChild(document.createElement('br'));
    }
  });

  const wordSpans = revealText.querySelectorAll('.reveal-word');

  window.addEventListener('scroll', () => {
    const rect = revealText.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    // Start revealing when the top of the text enters 85% from top of window
    // Finish revealing when the top of the text reaches 35% from top of window
    const startOffset = windowHeight * 0.85;
    const endOffset = windowHeight * 0.35;
    
    let progress = (startOffset - rect.top) / (startOffset - endOffset);
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;

    wordSpans.forEach((span, index) => {
      const start = index / wordSpans.length;
      const end = (index + 1) / wordSpans.length;
      
      let wordProgress = (progress - start) / (end - start);
      if (wordProgress < 0) wordProgress = 0;
      if (wordProgress > 1) wordProgress = 1;
      
      const alpha = 0.15 + (0.85 * wordProgress);
      span.style.color = `rgba(23, 21, 18, ${alpha})`;
    });
  }, { passive: true });
}

/* ============================================================
   STAT COUNTER ANIMATION
   ============================================================ */
const statNumbers = document.querySelectorAll('.stat-num');
if (statNumbers.length > 0) {
  const statObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const countTo = parseInt(target.getAttribute('data-count'), 10);
        const duration = 2500; // 2.5 seconds for smoother, longer count

        // Wait a tiny bit for the reveal animation to start making it visible
        setTimeout(() => {
          const startTime = performance.now();

          const updateCounter = (currentTime) => {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            
            // Easing function (easeOutQuart) for a smooth finish
            const easeOut = 1 - Math.pow(1 - progress, 4);
            const currentCount = Math.floor(easeOut * countTo);
            
            target.textContent = currentCount;

            if (progress < 1) {
              requestAnimationFrame(updateCounter);
            } else {
              target.textContent = countTo;
            }
          };
          requestAnimationFrame(updateCounter);
        }, 200); // 200ms delay

        observer.unobserve(target); // Only animate once
      }
    });
  }, { threshold: 0.8 }); // Only trigger when 80% visible

  statNumbers.forEach(stat => {
    statObserver.observe(stat);
  });
}

/* ============================================================
   FOOTER YEAR
   ============================================================ */
const footerYear = document.getElementById('footer-year');
if (footerYear) footerYear.textContent = String(new Date().getFullYear());

/* ============================================================
   MAGNETIC BUTTONS — subtle cursor-follow micro-interaction
   ============================================================ */
if (!prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    let raf = null;
    const strength = 0.35;

    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
    });

    btn.addEventListener('mouseleave', () => {
      if (raf) cancelAnimationFrame(raf);
      btn.style.transform = '';
    });
  });
}
