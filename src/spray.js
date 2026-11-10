// Hero "spray to clean": the dirty photo sits on top of the clean one, and the visitor's
// cursor (or finger) blasts the grime away. Cleaned areas look wet for a moment and then
// dry. When nobody is touching it, an automatic wand washes it in stripes.

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export async function initSpray(canvas, { before, after, onProgress, reduced = false }) {
  const [imgB, imgA] = await Promise.all([loadImg(before), loadImg(after)]);
  const ctx = canvas.getContext('2d');
  const dirt = document.createElement('canvas'); const dctx = dirt.getContext('2d');
  const wet = document.createElement('canvas'); const wctx = wet.getContext('2d');
  const probe = document.createElement('canvas'); probe.width = 64; probe.height = 40;
  const pctx = probe.getContext('2d', { willReadFrequently: true });

  let W = 0, H = 0, dpr = 1, cover = null;
  let pointer = null, last = null, lastInput = -1e9, autoT = 0, cleanPct = 0, visible = true;
  let mode = 'auto';            // 'auto' | 'user' | 'refill'
  let refillA = 0, doneAt = 0;
  const parts = [];

  function coverRect(img) {
    const s = Math.max(W / img.width, H / img.height);
    return { w: img.width * s, h: img.height * s, x: (W - img.width * s) / 2, y: (H - img.height * s) / 2 };
  }
  function resetDirt() {
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, W, H);
    dctx.drawImage(imgB, cover.x, cover.y, cover.w, cover.h);
    wctx.clearRect(0, 0, W, H);
    cleanPct = 0; onProgress?.(0);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = Math.round(r.width), nh = Math.round(r.height);
    if (nw === W && nh === H) return;
    // keep the cleaning progress when the window resizes
    const old = W ? (() => { const c = document.createElement('canvas'); c.width = dirt.width; c.height = dirt.height; c.getContext('2d').drawImage(dirt, 0, 0); return c; })() : null;
    W = nw; H = nh;
    for (const c of [canvas, dirt, wet]) { c.width = W * dpr; c.height = H * dpr; }
    for (const c of [ctx, dctx, wctx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    cover = coverRect(imgB);
    if (old) { dctx.drawImage(imgB, cover.x, cover.y, cover.w, cover.h); dctx.globalCompositeOperation = 'destination-in'; dctx.drawImage(old, 0, 0, W, H); dctx.globalCompositeOperation = 'source-over'; }
    else resetDirt();
  }

  // one blast of water at (x, y): erase dirt with a soft, slightly ragged brush
  const R = () => Math.max(46, Math.min(W, H) * 0.075);
  function blast(x, y, strength = 1) {
    const r = R();
    dctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() - 0.5) * r * 0.5, oy = (Math.random() - 0.5) * r * 0.5;
      const g = dctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, `rgba(0,0,0,${0.55 * strength})`); g.addColorStop(0.6, `rgba(0,0,0,${0.3 * strength})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); dctx.fill();
    }
    dctx.globalCompositeOperation = 'source-over';
    const wg = wctx.createRadialGradient(x, y, 0, x, y, r * 1.1);
    wg.addColorStop(0, 'rgba(40,56,70,0.16)'); wg.addColorStop(1, 'rgba(20,32,44,0)');
    wctx.fillStyle = wg; wctx.beginPath(); wctx.arc(x, y, r * 1.1, 0, Math.PI * 2); wctx.fill();
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 520;
      parts.push({ x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 120, life: 0.25 + Math.random() * 0.4, age: 0, r: 1 + Math.random() * 2.2 });
    }
  }
  function sweep(from, to, strength) {
    const d = Math.hypot(to.x - from.x, to.y - from.y), step = R() * 0.35;
    const n = Math.max(1, Math.ceil(d / step));
    for (let i = 1; i <= n; i++) blast(from.x + (to.x - from.x) * (i / n), from.y + (to.y - from.y) * (i / n), strength);
  }

  // automatic wand: serpentine stripes across the frame
  function autoPos(t) {
    const rows = Math.max(4, Math.round(H / (R() * 1.5)));
    const per = 2.1, k = (t / per) % rows, row = Math.floor(k), f = k - row;
    const e = f * f * (3 - 2 * f) * 0.4 + f * 0.6;
    const x0 = -R(), x1 = W + R();
    return { x: row % 2 ? x1 - (x1 - x0) * e : x0 + (x1 - x0) * e, y: (row + 0.5) * (H / rows) };
  }

  function measure() {
    pctx.clearRect(0, 0, 64, 40);
    pctx.drawImage(dirt, 0, 0, 64, 40);
    const d = pctx.getImageData(0, 0, 64, 40).data;
    let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i];
    cleanPct = 1 - a / (255 * 64 * 40);
    onProgress?.(cleanPct);
  }

  function drawNozzle(p) {
    // fan of water from an off-screen lance down to the surface
    const nx = p.x + 70, ny = p.y - 150;
    const g = ctx.createLinearGradient(nx, ny, p.x, p.y);
    g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(225,244,255,0.12)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(nx - 3, ny); ctx.lineTo(p.x - R() * 0.8, p.y + 4); ctx.lineTo(p.x + R() * 0.8, p.y + 10); ctx.lineTo(nx + 3, ny); ctx.fill();
    const mist = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, R() * 1.4);
    mist.addColorStop(0, 'rgba(255,255,255,0.5)'); mist.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mist; ctx.beginPath(); ctx.ellipse(p.x, p.y, R() * 1.5, R() * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#161a1f'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + 600, ny + 720); ctx.stroke();
    ctx.strokeStyle = '#3c434c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(nx + 3, ny + 1); ctx.lineTo(nx + 603, ny + 721); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(nx - 8, ny - 4, 16, 20);
  }

  let prevT = performance.now(), lastMeasure = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { prevT = now; return; }
    const dt = Math.min(0.05, (now - prevT) / 1000); prevT = now;
    const idle = now - lastInput > 2600;
    let nozzle = null;

    if (pointer && !idle) { mode = 'user'; nozzle = pointer; if (last) sweep(last, pointer, 1); last = { ...pointer }; }
    else {
      last = null;
      if (mode === 'user' && idle) mode = 'auto';
      if (mode === 'auto' && !reduced) {
        if (cleanPct > 0.985) { if (!doneAt) doneAt = now; if (now - doneAt > 1800) { mode = 'refill'; refillA = 0; doneAt = 0; } }
        else {
          const a = autoPos(autoT); autoT += dt; const b = autoPos(autoT);
          sweep(a, b, 1); nozzle = b;
        }
      }
      if (mode === 'refill') {
        // grime fades back in so the demo loops
        refillA = Math.min(1, refillA + dt * 0.8);
        dctx.globalAlpha = dt * 2.2; dctx.drawImage(imgB, cover.x, cover.y, cover.w, cover.h); dctx.globalAlpha = 1;
        if (refillA >= 1) { resetDirt(); autoT = 0; mode = 'auto'; }
      }
    }

    // wet sheen dries off over time
    wctx.globalCompositeOperation = 'destination-out'; wctx.fillStyle = `rgba(0,0,0,${dt * 0.9})`; wctx.fillRect(0, 0, W, H); wctx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(imgA, cover.x, cover.y, cover.w, cover.h);
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(wet, 0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dirt, 0, 0, W, H);
    if (nozzle) drawNozzle(nozzle);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.vx *= 0.97;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - p.age / p.life)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    if (now - lastMeasure > 350) { lastMeasure = now; measure(); }
  }

  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; pointer = local(e); lastInput = performance.now(); });
  canvas.addEventListener('pointerleave', () => { pointer = null; });
  // touch: wash where the finger moves, without blocking page scroll
  canvas.addEventListener('touchstart', (e) => { pointer = local(e.touches[0]); last = null; lastInput = performance.now(); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { pointer = local(e.touches[0]); lastInput = performance.now(); }, { passive: true });
  canvas.addEventListener('touchend', () => { pointer = null; }, { passive: true });

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  resize();
  requestAnimationFrame(frame);

  return {
    reset() { resetDirt(); autoT = 0; mode = 'auto'; lastInput = -1e9; },
    get progress() { return cleanPct; },
  };
}
