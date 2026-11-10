// Renders the placeholder "watch it work" clip: a wand cleaning a driveway in serpentine
// passes, with spray, splash and wet concrete that dries behind it. Runs in a browser page
// (see tools/gen-media.mjs). Swap public/media/wash.mp4 for real job footage before client use.

window.makeWashRenderer = async function (beforeUrl, afterUrl, VW = 1280, VH = 720, DUR = 12) {
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const [before, after] = await Promise.all([load(beforeUrl), load(afterUrl)]);
  const IW = before.width, IH = before.height;
  const GW = 320, GH = 200; // cleaning grid in image space (5px cells)
  const ct = new Float32Array(GW * GH).fill(-1);
  const cov = new Float32Array(GW * GH); // 0..1 how clean each cell is (soft edges)

  const cv = document.createElement('canvas'); cv.width = VW; cv.height = VH;
  const ctx = cv.getContext('2d');
  const mask = document.createElement('canvas'); mask.width = GW; mask.height = GH;
  const mctx = mask.getContext('2d'); const mdata = mctx.createImageData(GW, GH);
  const wet = document.createElement('canvas'); wet.width = GW; wet.height = GH;
  const wctx = wet.getContext('2d'); const wdata = wctx.createImageData(GW, GH);
  const layer = document.createElement('canvas'); layer.width = IW; layer.height = IH;
  const lctx = layer.getContext('2d');

  // serpentine path over the visible part of the image
  const ROWS = 7, top = 100, rowH = 128, x0 = -60, x1 = IW + 60;
  const passT = (DUR - 1.4) / ROWS;
  function wandAt(t) {
    const k = Math.min(ROWS - 0.0001, Math.max(0, t / passT));
    const row = Math.floor(k), f = k - row;
    const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2; // ease within each pass
    const lin = f * 0.7 + e * 0.3;
    const x = row % 2 ? x1 - (x1 - x0) * lin : x0 + (x1 - x0) * lin;
    return { x, y: top + row * rowH + rowH / 2, active: t < passT * ROWS };
  }

  let rnd = 1; const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const parts = [];
  let lastT = 0;

  function step(t) {
    // advance cleaning in small sub-steps so fast moves leave no gaps
    for (let s = lastT; s <= t; s += 1 / 240) {
      const w = wandAt(s);
      if (!w.active) continue;
      const cx = w.x / 5, cy = w.y / 5, rx = 16, ry = 18;
      for (let gy = Math.floor(cy - ry); gy <= cy + ry; gy++) for (let gx = Math.floor(cx - rx); gx <= cx + rx; gx++) {
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        const dd = ((gx - cx) / rx) ** 2 + ((gy - cy) / ry) ** 2;
        const j = gy * GW + gx;
        const edge = 0.55 + 0.35 * Math.sin(gx * 1.7 + gy * 2.3) * Math.sin(gx * 0.31 - gy * 0.7);
        const a = 1 - Math.min(1, Math.max(0, (dd - edge) / (1.25 - edge)));
        if (a > cov[j]) cov[j] = a;
        if (cov[j] > 0.3 && ct[j] < 0) ct[j] = s;
      }
    }
    const dt = t - lastT; lastT = t;
    const w = wandAt(t);
    if (w.active) for (let i = 0; i < 70; i++) {
      const a = rand() * Math.PI * 2, sp = 200 + rand() * 900;
      parts.push({ x: w.x + (rand() - 0.5) * 120, y: w.y + (rand() - 0.5) * 50, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 150, life: 0.15 + rand() * 0.35, age: 0, r: 1 + rand() * 2.5 });
    }
    for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.vx *= 0.96; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].life) parts.splice(i, 1);
  }

  function frame(t) {
    step(t);
    for (let i = 0; i < GW * GH; i++) {
      const c = ct[i], on = c >= 0;
      mdata.data[i * 4 + 3] = cov[i] * 255;
      const age = on ? t - c : 0;
      wdata.data[i * 4] = 120; wdata.data[i * 4 + 1] = 128; wdata.data[i * 4 + 2] = 136;
      wdata.data[i * 4 + 3] = on ? cov[i] * 255 * 0.85 * Math.exp(-age / 1.4) : 0;
    }
    mctx.putImageData(mdata, 0, 0); wctx.putImageData(wdata, 0, 0);

    // compose in image space: dirty, then clean through the mask, then wet darkening
    lctx.globalCompositeOperation = 'source-over';
    lctx.drawImage(after, 0, 0);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.imageSmoothingEnabled = true; lctx.drawImage(mask, 0, 0, IW, IH);
    lctx.globalCompositeOperation = 'destination-over';
    lctx.drawImage(before, 0, 0);
    lctx.globalCompositeOperation = 'multiply';
    lctx.globalAlpha = 1; lctx.drawImage(wet, 0, 0, IW, IH);
    lctx.globalCompositeOperation = 'source-over';

    // gentle camera push-in that follows the wand a little
    const w = wandAt(t);
    const z = 1.0 + 0.1 * (t / DUR);
    const sc = (VW / IW) * 1.06 * z;
    const vx = Math.min(0, Math.max(VW - IW * sc, VW / 2 - (IW / 2 + (w.x - IW / 2) * 0.25) * sc));
    const vy = Math.min(0, Math.max(VH - IH * sc, VH / 2 - (IH / 2 + (w.y - IH / 2) * 0.3) * sc));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, vx, vy, IW * sc, IH * sc);
    ctx.setTransform(sc, 0, 0, sc, vx, vy);

    if (w.active) {
      // fan of water from the nozzle
      const nx = w.x + 120, ny = w.y - 260;
      const g = ctx.createLinearGradient(nx, ny, w.x, w.y);
      g.addColorStop(0, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(230,245,255,0.18)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(nx - 4, ny); ctx.lineTo(w.x - 70, w.y); ctx.lineTo(w.x + 70, w.y + 10); ctx.lineTo(nx + 4, ny); ctx.fill();
      const mist = ctx.createRadialGradient(w.x, w.y, 5, w.x, w.y, 150);
      mist.addColorStop(0, 'rgba(255,255,255,0.55)'); mist.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = mist; ctx.beginPath(); ctx.ellipse(w.x, w.y, 160, 80, 0, 0, Math.PI * 2); ctx.fill();
      // the lance coming in from bottom right
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1b1f24'; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + 900, ny + 1100); ctx.stroke();
      ctx.strokeStyle = '#3a4048'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(nx + 4, ny + 2); ctx.lineTo(nx + 904, ny + 1102); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(nx - 12, ny - 6, 24, 30);
    }
    for (const p of parts) {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - p.age / p.life)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // fade back to the dirty start so the loop is seamless
    const fadeA = Math.max(0, (t - (DUR - 0.7)) / 0.7);
    if (fadeA > 0) {
      ctx.globalAlpha = fadeA;
      const sc0 = (VW / IW) * 1.06; const w0 = wandAt(0);
      const vx0 = Math.min(0, Math.max(VW - IW * sc0, VW / 2 - (IW / 2 + (w0.x - IW / 2) * 0.25) * sc0));
      const vy0 = Math.min(0, Math.max(VH - IH * sc0, VH / 2 - (IH / 2 + (w0.y - IH / 2) * 0.3) * sc0));
      ctx.drawImage(before, vx0, vy0, IW * sc0, IH * sc0);
      ctx.globalAlpha = 1;
    }
    return cv.toDataURL('image/jpeg', 0.9);
  }
  return { frame };
};
