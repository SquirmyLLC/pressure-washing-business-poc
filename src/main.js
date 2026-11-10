import '@fontsource-variable/inter';
import '@fontsource-variable/archivo/wdth.css';
import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initSpray } from './spray.js';

gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
// Paths in JS must stay relative (no leading slash) so the build works from any folder.
const media = (f) => `media/${f}`;

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  const el = id.length > 1 ? $(id) : null;
  if (!el && id !== '#top') return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(el || 0, { offset: -70 });
  else (el || document.body).scrollIntoView();
}));

/* ---------- nav ---------- */
const nav = $('#nav'), bar = $('.mobile-bar');
let lastY = 0;
function onScroll() {
  const y = window.scrollY, heroH = $('.hero').offsetHeight;
  nav.classList.toggle('is-solid', y > heroH - 90);
  nav.classList.toggle('is-hidden', y > 300 && y > lastY && y < document.body.scrollHeight - innerHeight - 50);
  bar.classList.toggle('is-on', y > heroH * 0.6);
  lastY = y;
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- hero ---------- */
// the background and the card play the same clip; keep them in step
const heroVids = $$('.hero video');
if (reduced) heroVids.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
else {
  heroVids.forEach((v) => v.play().catch(() => {}));
  setInterval(() => { const [bg, card] = heroVids; if (card && !card.paused && Math.abs(bg.currentTime - card.currentTime) > 0.15) bg.currentTime = card.currentTime; }, 2000);
  gsap.from('.hero-inner > *', { y: 40, opacity: 0, duration: 1, stagger: 0.08, ease: 'power3.out', delay: 0.1 });
  gsap.from('.hero-card', { y: 60, rotate: 8, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.25 });
  gsap.from('.hero-chip', { scale: 0.6, opacity: 0, duration: 0.7, stagger: 0.15, ease: 'back.out(2)', delay: 0.9 });
  gsap.to('.hero-card', { yPercent: -12, rotate: -1, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

/* ---------- scroll story: scroll scrubs the driveway time-lapse ---------- */
const steps = $$('.story-step');
const storyBar = $('#story-bar'), storyVid = $('#story-video'), storyTag = $('#story-tag'), storyHint = $('#story-hint');
function setStep(i) { steps.forEach((s, k) => s.classList.toggle('is-active', k === i)); }
if (!reduced) {
  let target = 0, seeking = false;
  const seek = () => {
    if (!storyVid.duration) return;
    const t = Math.min(storyVid.duration - 0.05, target * storyVid.duration);
    if (Math.abs(storyVid.currentTime - t) < 0.02) { seeking = false; return; }
    seeking = true; storyVid.currentTime = t;
  };
  storyVid.addEventListener('seeked', () => { seeking = false; if (Math.abs(storyVid.currentTime - target * storyVid.duration) > 0.04) seek(); });
  storyVid.addEventListener('loadedmetadata', seek);
  // Load the whole clip into memory before scrubbing: seeking then works on any host,
  // even ones that don't support byte-range requests.
  const scrubSrc = storyVid.getAttribute('src');
  storyVid.removeAttribute('src'); storyVid.load();
  let loading = false;
  const loadScrub = () => {
    if (loading) return; loading = true;
    fetch(scrubSrc).then((r) => r.blob()).then((b) => { storyVid.src = URL.createObjectURL(b); })
      .catch(() => { storyVid.src = scrubSrc; });
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) loadScrub(); }, { rootMargin: '150% 0px' }).observe(storyVid);
  // iOS only seeks a video after it has been played once
  const unlock = () => { storyVid.play().then(() => { storyVid.pause(); seek(); }).catch(() => {}); };
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  ScrollTrigger.create({
    trigger: '.story', start: 'top top', end: () => '+=' + innerHeight * 2.6,
    pin: '.story-pin', scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      // hold the dirty frame for the first bit so the "problem" step reads, then wash
      target = gsap.utils.clamp(0, 1, (p - 0.12) / 0.8);
      if (!seeking) seek();
      storyBar.style.width = p * 100 + '%';
      setStep(p < 0.2 ? 0 : p < 0.85 ? 1 : 2);
      const clean = target > 0.97;
      storyTag.textContent = clean ? 'After' : target > 0.02 ? 'Washing…' : 'Before';
      storyTag.classList.toggle('is-clean', clean);
      storyHint.classList.toggle('is-gone', p > 0.05);
    },
  });
} else {
  document.documentElement.classList.add('no-motion');
  storyVid.poster = media('driveway-after.jpg');
  storyTag.textContent = 'After'; storyHint.hidden = true;
  steps.forEach((s) => { s.classList.add('is-active'); s.style.position = 'static'; s.style.marginBottom = '40px'; });
}

/* ---------- reels: play while on screen ---------- */
const playInView = (v, threshold = 0.35) => new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !reduced) v.play().catch(() => {}); else v.pause();
}, { threshold }).observe(v);
$$('.reel-card video').forEach((v) => playInView(v));
if (!reduced) {
  gsap.from('.reel-card', { y: 120, opacity: 0, duration: 1.1, stagger: 0.15, ease: 'power3.out', scrollTrigger: { trigger: '.reels', start: 'top 85%', once: true } });
  gsap.to('.reel-card:nth-child(2)', { y: -60, ease: 'none', scrollTrigger: { trigger: '.reels', start: 'top bottom', end: 'bottom top', scrub: true } });
}
const sqft = $('#reel-sqft'), target = 1284500;
ScrollTrigger.create({
  trigger: '.reels', start: 'top 75%', once: true,
  onEnter: () => gsap.to({ v: 0 }, { v: target, duration: reduced ? 0 : 2.2, ease: 'power2.out', onUpdate() { sqft.textContent = Math.round(this.targets()[0].v).toLocaleString(); } }),
});

/* ---------- before/after slider ---------- */
const ba = $('#ba'), range = $('.ba-range', ba);
let pos = 50;
function setPos(v) { pos = Math.max(0, Math.min(100, v)); ba.style.setProperty('--pos', pos + '%'); range.value = pos; }
function fromEvent(e) { const r = ba.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); }
let dragging = false;
ba.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    // only grab on touch when the finger lands near the handle, so the page can still scroll
    const r = ba.getBoundingClientRect();
    if (Math.abs(e.clientX - (r.left + (r.width * pos) / 100)) > 50) return;
  }
  dragging = true; ba.classList.add('is-dragging'); ba.setPointerCapture(e.pointerId); fromEvent(e); intro?.kill();
});
ba.addEventListener('pointermove', (e) => { if (dragging) { e.preventDefault(); fromEvent(e); } });
ba.addEventListener('pointerup', () => { dragging = false; ba.classList.remove('is-dragging'); });
ba.addEventListener('pointercancel', () => { dragging = false; ba.classList.remove('is-dragging'); });
// handle grabs on touch need touch-action off while dragging
ba.addEventListener('touchmove', (e) => { if (dragging) e.preventDefault(); }, { passive: false });
range.addEventListener('input', () => { setPos(+range.value); intro?.kill(); });
range.style.pointerEvents = 'none';
ba.tabIndex = -1;
// keyboard: the range input is focusable; arrows move it

let intro = null;
ScrollTrigger.create({
  trigger: ba, start: 'top 70%', once: true,
  onEnter: () => {
    if (reduced) return;
    const o = { v: 50 };
    intro = gsap.timeline({ onUpdate: () => setPos(o.v) })
      .to(o, { v: 12, duration: 0.9, ease: 'power2.inOut' })
      .to(o, { v: 88, duration: 1.3, ease: 'power2.inOut' })
      .to(o, { v: 50, duration: 0.9, ease: 'power2.inOut' });
  },
});

/* ---------- wash it yourself ---------- */
const fill = $('#meter-fill'), num = $('#meter-num'), resetBtn = $('#spray-reset');
if (matchMedia('(hover: none)').matches) $('.result-card .hint-text').textContent = 'Swipe across the driveway';
let sprayStarted = false;
ScrollTrigger.create({
  trigger: '#spray-canvas', start: 'top bottom', once: true,
  onEnter: () => {
    if (sprayStarted) return; sprayStarted = true;
    initSpray($('#spray-canvas'), {
      before: media('driveway-before.jpg'), after: media('driveway-after.jpg'), reduced,
      onProgress(p) { const pct = Math.round(p * 100); fill.style.width = pct + '%'; num.textContent = pct + '%'; resetBtn.hidden = pct < 50; },
    }).then((spray) => resetBtn.addEventListener('click', () => spray.reset()));
  },
});

/* ---------- service cards: play the clip on hover ---------- */
const canHover = matchMedia('(hover: hover)').matches;
$$('.svc').forEach((card) => {
  const v = $('video', card);
  const play = () => { if (reduced) return; card.classList.add('is-playing'); v.play().catch(() => {}); };
  const stop = () => { card.classList.remove('is-playing'); v.pause(); };
  if (canHover) { card.addEventListener('pointerenter', play); card.addEventListener('pointerleave', stop); }
  else ScrollTrigger.create({ trigger: card, start: 'top 70%', end: 'bottom 30%', onToggle: (self) => (self.isActive ? play() : stop()) });
});
if (!canHover) $('#services .section-sub').textContent = 'Scroll to see us work.';

/* ---------- pricing calculator ---------- */
const BASE = { driveway: 149, house: 299, deck: 199, patio: 179, roof: 449 };
const SIZE = [{ n: 'Small', m: 0.8 }, { n: 'Medium', m: 1 }, { n: 'Large', m: 1.35 }, { n: 'XL', m: 1.75 }];
const calc = $('#calc'), priceEl = $('#price'), note = $('#price-note'), sizeOut = $('#size-out');
const shown = { v: 0 };
function updatePrice() {
  const svcs = $$('input[name=svc]:checked', calc).map((i) => i.value);
  const size = SIZE[+$('#size').value];
  const cond = +$('input[name=cond]:checked', calc).value;
  let total = svcs.reduce((s, k) => s + BASE[k], 0) * size.m * cond;
  const bundle = svcs.length >= 2;
  if (bundle) total *= 0.85;
  total = Math.round(total / 5) * 5;
  sizeOut.textContent = size.n;
  note.textContent = svcs.length === 0 ? 'Pick at least one service' : bundle ? `${svcs.length} services · bundle 15% off applied` : 'One service · add another to save 15%';
  gsap.to(shown, { v: total, duration: reduced ? 0 : 0.6, ease: 'power3.out', overwrite: true, onUpdate: () => { priceEl.textContent = Math.round(shown.v).toLocaleString(); } });
}
calc.addEventListener('input', updatePrice);
updatePrice();

/* ---------- quote form (front end only) ---------- */
const form = $('#quote-form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  let ok = true;
  $$('[required]', form).forEach((inp) => { const bad = !inp.value.trim(); inp.closest('.field').classList.toggle('is-invalid', bad); if (bad && ok) { inp.focus(); ok = false; } });
  if (!ok) return;
  const done = $('.quote-done', form); done.hidden = false;
  if (!reduced) gsap.from(done, { opacity: 0, scale: 0.96, duration: 0.5, ease: 'power3.out' });
});

/* ---------- section reveals ---------- */
if (!reduced) {
  $$('.section-head, .how-steps li, .svc, .ba-captions li, .area, .faq, .quote-grid > *').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
}
window.addEventListener('load', () => ScrollTrigger.refresh());
