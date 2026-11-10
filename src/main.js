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

/* ---------- hero: spray to clean ---------- */
const fill = $('#meter-fill'), num = $('#meter-num'), resetBtn = $('#spray-reset'), hint = $('#spray-hint');
if (matchMedia('(hover: none)').matches) $('.hint-text').textContent = 'Swipe to spray';
initSpray($('#hero-canvas'), {
  before: media('driveway-before.jpg'),
  after: media('driveway-after.jpg'),
  reduced,
  onProgress(p) {
    const pct = Math.round(p * 100);
    fill.style.width = pct + '%'; num.textContent = pct + '%';
    resetBtn.hidden = pct < 60;
  },
}).then((spray) => {
  resetBtn.addEventListener('click', () => spray.reset());
  $('#hero-canvas').addEventListener('pointermove', () => hint.classList.add('is-gone'), { once: true });
});

if (!reduced) {
  gsap.from('.hero-inner > *', { y: 40, opacity: 0, duration: 1, stagger: 0.08, ease: 'power3.out', delay: 0.1 });
  gsap.from('.hero-meter', { y: 20, opacity: 0, duration: 0.8, delay: 0.8, ease: 'power3.out' });
}

/* ---------- scroll story ---------- */
const steps = $$('.story-step');
const storyBar = $('#story-bar');
function setStep(i) { steps.forEach((s, k) => s.classList.toggle('is-active', k === i)); }
if (!reduced) {
  const after = $('.story-after'), wand = $('.story-wand'), before = $('.story-before');
  const st = { p: 0 };
  const render = () => {
    const p = st.p;
    // 0-0.22 problem (zoom into grime), 0.22-0.8 wand sweeps, 0.8-1 done
    const sweep = gsap.utils.clamp(0, 1, (p - 0.22) / 0.58);
    after.style.clipPath = `inset(0 ${100 - sweep * 100}% 0 0)`;
    wand.style.left = sweep * 100 + '%';
    wand.style.opacity = sweep > 0 && sweep < 1 ? 1 : 0;
    const zoom = 1 + 0.12 * (1 - gsap.utils.clamp(0, 1, p / 0.22)) * gsap.utils.clamp(0, 1, p / 0.05 + 0.6);
    before.style.transform = after.firstElementChild.style.transform = `scale(${zoom})`;
    storyBar.style.width = p * 100 + '%';
    setStep(p < 0.22 ? 0 : p < 0.82 ? 1 : 2);
  };
  ScrollTrigger.create({
    trigger: '.story', start: 'top top', end: () => '+=' + innerHeight * 2.4,
    pin: '.story-pin', scrub: 0.6,
    onUpdate: (self) => { gsap.to(st, { p: self.progress, duration: 0.25, overwrite: true, onUpdate: render }); },
  });
  render();
} else {
  document.documentElement.classList.add('no-motion');
  steps.forEach((s) => { s.classList.add('is-active'); s.style.position = 'static'; s.style.marginBottom = '40px'; });
}

/* ---------- video reel ---------- */
const video = $('#reel-video');
new IntersectionObserver(([e]) => { if (e.isIntersecting) video.play().catch(() => {}); else video.pause(); }, { threshold: 0.2 }).observe(video);
if (!reduced) {
  const mobile = matchMedia('(max-width: 760px)').matches;
  gsap.fromTo('#reel-frame', { clipPath: mobile ? 'inset(4% 4% round 20px)' : 'inset(6% 10% round 28px)' }, {
    clipPath: 'inset(0% 0% round 0px)', ease: 'none',
    scrollTrigger: { trigger: '#reel-frame', start: 'top 85%', end: 'center 50%', scrub: true },
  });
}
const sqft = $('#reel-sqft'), target = 1284500;
ScrollTrigger.create({
  trigger: '#reel-frame', start: 'top 60%', once: true,
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

const labels = { driveway: ['stained driveway', 'clean driveway'], siding: ['green, algae-streaked siding', 'bright clean siding'], deck: ['grey, mildewed deck', 'restored wood deck'], brick: ['soot-streaked brick wall', 'clean brick wall'] };
$$('.ba-tabs button').forEach((btn) => btn.addEventListener('click', () => {
  $$('.ba-tabs button').forEach((b) => b.setAttribute('aria-selected', b === btn));
  const k = btn.dataset.pair, b = $('#ba-before'), a = $('#ba-after');
  b.style.opacity = a.style.opacity = 0;
  setTimeout(() => {
    b.src = media(`${k}-before.jpg`); a.src = media(`${k}-after.jpg`);
    b.alt = 'Before: ' + labels[k][0]; a.alt = 'After: ' + labels[k][1];
    Promise.all([b.decode(), a.decode()]).catch(() => {}).then(() => { b.style.opacity = a.style.opacity = 1; });
    if (!reduced) { const o = { v: 15 }; setPos(15); gsap.to(o, { v: 55, duration: 1.1, ease: 'power3.out', onUpdate: () => setPos(o.v) }); }
  }, 250);
}));

/* ---------- service cards: wipe clean from the cursor ---------- */
const canHover = matchMedia('(hover: hover)').matches;
$$('.svc').forEach((card) => {
  const m = $('.svc-media', card);
  const at = (e) => { const r = m.getBoundingClientRect(); m.style.setProperty('--x', ((e.clientX - r.left) / r.width) * 100 + '%'); m.style.setProperty('--y', ((e.clientY - r.top) / r.height) * 100 + '%'); };
  if (canHover) {
    card.addEventListener('pointerenter', (e) => { at(e); card.classList.add('is-clean'); });
    card.addEventListener('pointerleave', (e) => { at(e); card.classList.remove('is-clean'); });
  } else {
    ScrollTrigger.create({ trigger: card, start: 'top 55%', end: 'bottom 20%', toggleClass: 'is-clean' });
  }
});
if (!canHover) $('#services .section-sub').textContent = 'Scroll to wash each one.';

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
