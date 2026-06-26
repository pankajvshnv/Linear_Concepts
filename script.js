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
const video        = document.getElementById('source-video');
const heroImg      = document.getElementById('hero-frame');
const spacer       = document.getElementById('spacer');
const overlay      = document.getElementById('loading-overlay');
const percentLabel = document.getElementById('loading-percent');
const barFill      = document.getElementById('loading-bar-fill');
const header       = document.getElementById('site-header');

// Allow cross-origin video (required for canvas.toBlob)
video.crossOrigin = 'anonymous';

let blobUrls    = [];
let scrollReady = false;
let earlyInit   = false;

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

async function extractAllFrames() {
  const canvas = document.createElement('canvas');
  canvas.width  = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext('2d');
  const duration = video.duration;

  for (let i = 0; i < FRAME_COUNT; i++) {
    let time = (i / (FRAME_COUNT - 1)) * duration;
    if (i === 0) time = 0.001; // avoid stuck seek at 0

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(tid);
        resolve();
      };
      const onSeeked = () => finish();
      const tid = setTimeout(finish, 2000); // safety net
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });

    ctx.drawImage(video, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    blobUrls.push(await captureFrame(canvas));
    setLoadingProgress((i + 1) / FRAME_COUNT);

    // Show the page immediately after the first frame is ready
    if (!earlyInit && blobUrls.length >= SHOW_AFTER) {
      earlyInit = true;
      init();
    }
  }
}

function getScrollProgress() {
  const rect = spacer.getBoundingClientRect();
  const scrollable = rect.height - window.innerHeight;
  return Math.min(Math.max(-rect.top / scrollable, 0), 1);
}

function updateFrame() {
  if (!scrollReady) return;
  const p = getScrollProgress();
  const idx = Math.round(p * (blobUrls.length - 1));
  if (heroImg.src !== blobUrls[idx]) heroImg.src = blobUrls[idx];
}

function init() {
  if (scrollReady) return; // prevent double-init
  heroImg.src = blobUrls[0];
  scrollReady  = true;
  window.addEventListener('scroll', updateFrame, { passive: true });
  window.addEventListener('resize', updateFrame);
  updateFrame();
  overlay.classList.add('hidden');
}

video.addEventListener('loadedmetadata', async () => {
  console.log('[LC] Video ready. Duration:', video.duration);
  try {
    await extractAllFrames();
    console.log('[LC] All frames extracted:', blobUrls.length);
    if (!earlyInit) init(); // final init if early one didn't fire
  } catch (err) {
    console.error('[LC] Frame extraction failed:', err);
    // Still show page on error — use video poster/fallback
    if (!earlyInit && blobUrls.length > 0) init();
    overlay.querySelector('.loading-sub').textContent =
      err.message?.includes('tainted') 
        ? 'Canvas tainted — check CORS on video.' 
        : 'Serve over http(s) — not file://. Then reload.';
  }
});

video.addEventListener('error', () => {
  console.error('[LC] Video failed to load.');
  overlay.querySelector('.loading-sub').textContent =
    'Video failed to load. Check assets/hero.mp4.';
});

setTimeout(() => {
  if (video.readyState === 0) {
    overlay.querySelector('.loading-sub').textContent =
      'Video not loading — serve via a local server, not file://';
  }
}, 5000);

// Auto-dismiss loading overlay after 15s as a last-resort fallback
setTimeout(() => {
  if (!overlay.classList.contains('hidden')) {
    overlay.classList.add('hidden');
    console.warn('[LC] Loading overlay force-dismissed after 15s');
  }
}, 15000);

// Skip button — dismiss overlay immediately
const skipBtn = document.getElementById('loading-skip');
if (skipBtn) {
  skipBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    if (!scrollReady && blobUrls.length > 0) init();
  });
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
  const target   = parseInt(el.dataset.count, 10);
  const duration = 1600;
  const start    = performance.now();

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
      animateCount(entry.target);
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });

statEls.forEach((el) => statObserver.observe(el));

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
