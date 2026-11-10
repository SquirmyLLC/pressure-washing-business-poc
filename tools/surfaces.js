// Procedural placeholder surfaces for the demo: each one renders a "clean" and a "dirty"
// version of the same surface, pixel-aligned, so every before/after effect has a pair.
// Replace public/media/*-before.jpg / *-after.jpg with real job photos before client use.
// Runs in a browser page (see tools/gen-media.mjs).

const W = 1600, H = 1000;

// ---------- noise ----------
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = fade(x - xi), yf = fade(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x, y, oct = 5, s = 0) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, s + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
  return v / norm;
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

function render(fn) {
  const clean = new ImageData(W, H), dirty = new ImageData(W, H);
  const c = [0, 0, 0], d = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    fn(x, y, c, d);
    const i = (y * W + x) * 4;
    // soft overhead light falloff so it reads as a photo, not a texture swatch
    const vig = 1 - 0.18 * (((x - W * 0.45) / W) ** 2 + ((y - H * 0.4) / H) ** 2) * 2;
    for (let k = 0; k < 3; k++) {
      clean.data[i + k] = clamp(c[k] * vig, 0, 255);
      dirty.data[i + k] = clamp(d[k] * vig, 0, 255);
    }
    clean.data[i + 3] = dirty.data[i + 3] = 255;
  }
  return { clean, dirty };
}

// ---------- surfaces ----------
function driveway(x, y, c, d) {
  const n = fbm(x / 260, y / 260, 5, 1);
  const fine = hash(x, y, 3), fine2 = vnoise(x / 2.5, y / 2.5, 4);
  let v = 196 + (n - 0.5) * 34 + (fine - 0.5) * 16 + (fine2 - 0.5) * 18;
  if (hash(x >> 1, y >> 1, 9) > 0.992) v -= 40; // dark aggregate flecks
  if (hash(x >> 1, y >> 1, 10) > 0.994) v += 25;
  // control joints, slightly wobbly
  const jx = Math.min(Math.abs(x - 560 - (vnoise(y / 80, 0, 2) - 0.5) * 6), Math.abs(x - 1140 - (vnoise(y / 80, 5, 2) - 0.5) * 6));
  const jy = Math.abs(y - 520 - (vnoise(x / 80, 9, 2) - 0.5) * 6);
  const j = Math.min(jx, jy);
  const joint = 1 - sstep(2, 5, j);
  const edge = (1 - sstep(4, 9, j)) * 0.08;
  v *= 1 - joint * 0.5 - edge;
  c[0] = v; c[1] = v * 0.985; c[2] = v * 0.95;

  // grime: overall dullness + blotches
  const m = fbm(x / 200, y / 200, 6, 7);
  let g = 0.45 + sstep(0.3, 0.75, m) * 0.45;
  // tyre tracks
  const tr = Math.max(1 - sstep(60, 110, Math.abs(x - 470 - Math.sin(y / 260) * 30)), 1 - sstep(60, 110, Math.abs(x - 1090 - Math.sin(y / 260) * 30)));
  g += tr * (0.25 + fbm(x / 30, y / 120, 4, 8) * 0.25);
  g = clamp(g, 0, 0.95);
  const dark = v * 0.42;
  let r = mix(v, dark * 1.05, g), gg = mix(v * 0.985, dark * 1.0, g), b = mix(v * 0.95, dark * 0.86, g);
  // oil stains
  const stains = [[760, 640, 120], [900, 420, 70], [1260, 760, 90], [300, 300, 55]];
  for (const [sx, sy, sr] of stains) {
    const dist = Math.hypot(x - sx, (y - sy) * 1.3) / sr + (fbm(x / 40, y / 40, 4, 11) - 0.5) * 0.9;
    const a = (1 - sstep(0.55, 1.05, dist)) * 0.75;
    r = mix(r, 34, a); gg = mix(gg, 31, a); b = mix(b, 29, a);
  }
  // moss / black growth in joints and speckled mildew
  const moss = (1 - sstep(3, 16, j)) * sstep(0.4, 0.7, fbm(x / 25, y / 25, 4, 12));
  r = mix(r, 58, moss); gg = mix(gg, 72, moss); b = mix(b, 30, moss);
  const sp = sstep(0.72, 0.8, fbm(x / 9, y / 9, 3, 13)) * 0.7;
  r = mix(r, 30, sp); gg = mix(gg, 32, sp); b = mix(b, 26, sp);
  d[0] = r; d[1] = gg; d[2] = b;
}

function brick(x, y, c, d) {
  const BH = 66, BW = 210, M = 9;
  const row = Math.floor(y / BH), off = row % 2 ? BW / 2 : 0;
  const col = Math.floor((x + off) / BW);
  const lx = (x + off) - col * BW, ly = y - row * BH;
  const inMortar = lx < M || ly < M;
  const edgeD = Math.min(lx - M, ly - M, BW - lx, BH - ly);
  const tone = hash(col, row, 21), tone2 = hash(col, row, 22);
  const grain = fbm(x / 6, y / 6, 3, 23), big = fbm(x / 90, y / 90, 3, 24);
  let r, g, b;
  if (inMortar) {
    const m = 196 + (grain - 0.5) * 40;
    r = m; g = m * 0.97; b = m * 0.9;
  } else {
    const shade = 0.82 + tone * 0.3 + (grain - 0.5) * 0.22 + (big - 0.5) * 0.15;
    r = (150 + tone2 * 40) * shade; g = (66 + tone2 * 22) * shade; b = (48 + tone * 16) * shade;
    if (hash(x, y, 25) > 0.97) { r *= 0.8; g *= 0.8; b *= 0.8; }
    const bevel = sstep(0, 5, edgeD);
    r *= 0.78 + 0.22 * bevel; g *= 0.78 + 0.22 * bevel; b *= 0.78 + 0.22 * bevel;
  }
  c[0] = r; c[1] = g; c[2] = b;
  // soot streaks running down from the top + green algae creeping up from the ground
  const streak = fbm(x / 26, y / 520, 5, 26);
  const soot = clamp((sstep(0.38, 0.72, streak) * 0.75 + 0.25) * (1.05 - y / H * 0.75), 0, 0.9);
  const algae = sstep(0.35, 0.7, fbm(x / 70, y / 70, 5, 27)) * sstep(0.35, 1, y / H) * 0.85;
  let dr = mix(r, r * 0.32 + 12, soot), dg = mix(g, g * 0.32 + 12, soot), db = mix(b, b * 0.34 + 12, soot);
  const mor = inMortar ? 0.35 : 0;
  dr = mix(dr, 62, algae + mor * 0.5); dg = mix(dg, 80, algae + mor * 0.5); db = mix(db, 40, algae + mor * 0.5);
  d[0] = dr; d[1] = dg; d[2] = db;
}

function deck(x, y, c, d) {
  const BH = 125, GAP = 9;
  const row = Math.floor(y / BH), ly = y - row * BH;
  const seam = Math.floor((x + hash(row, 0, 31) * 900) / 900);
  const board = row * 7 + seam;
  const tone = hash(board, 1, 32);
  const warp = fbm(x / 500, y / 40 + board, 4, 33) * 10;
  const grain = Math.sin(y / 3.2 + warp * 2.2 + Math.sin(x / 300 + board) * 2) * 0.5 + 0.5;
  const fine = fbm(x / 60, y / 2.5, 3, 34);
  const knot = (() => { const kx = hash(board, 2, 35) * W, ky = row * BH + BH * (0.3 + hash(board, 3, 36) * 0.4); const dd = Math.hypot((x - kx) / 2.2, y - ky); return 1 - sstep(4, 16, dd); })();
  let s = 0.78 + tone * 0.28 + (grain - 0.5) * 0.16 + (fine - 0.5) * 0.18 - knot * 0.35;
  const gapD = Math.min(ly, BH - ly);
  const inGap = ly < GAP;
  const bevel = sstep(GAP, GAP + 6, ly) * sstep(0, 5, BH - ly);
  const seamD = Math.abs(((x + hash(row, 0, 31) * 900) % 900));
  const seamLine = seamD < 3 ? 0.55 : 1;
  s *= (0.8 + 0.2 * bevel) * seamLine;
  let r = 184 * s, g = 116 * s, b = 64 * s;
  if (inGap) { r = 28; g = 22; b = 18; }
  c[0] = r; c[1] = g; c[2] = b;
  // weathered grey + mildew along the board edges + dark water spots
  const lum = (r * 0.3 + g * 0.59 + b * 0.11);
  const wz = 0.82;
  let dr = mix(r, lum * 0.78 + 8, wz), dg = mix(g, lum * 0.76 + 8, wz), db = mix(b, lum * 0.72 + 6, wz);
  const blot = sstep(0.45, 0.8, fbm(x / 120, y / 120, 5, 37)) * 0.5;
  dr *= 1 - blot; dg *= 1 - blot; db *= 1 - blot * 0.95;
  const mil = (1 - sstep(GAP, GAP + 26, gapD + (fbm(x / 20, y / 20, 3, 38) - 0.5) * 30)) * 0.7 * (inGap ? 0 : 1);
  dr = mix(dr, 52, mil); dg = mix(dg, 62, mil); db = mix(db, 34, mil);
  const sp = sstep(0.74, 0.8, fbm(x / 7, y / 7, 3, 39)) * 0.8;
  dr = mix(dr, 24, sp); dg = mix(dg, 25, sp); db = mix(db, 22, sp);
  if (inGap) { dr = 20; dg = 18; db = 15; }
  d[0] = dr; d[1] = dg; d[2] = db;
}

function siding(x, y, c, d) {
  const LH = 104;
  const row = Math.floor(y / LH), ly = y - row * LH;
  const t = ly / LH;
  // each lap: dark shadow line under the lap above, then light ramp, slight bulge
  const shadow = 1 - sstep(0, 0.12, t) * 0.9;
  const ramp = 0.9 + 0.12 * t;
  const emboss = (fbm(x / 140, y / 3, 3, 41) - 0.5) * 0.05 + (hash(x, y, 42) - 0.5) * 0.03;
  let s = ramp * (1 - shadow * 0.42) + emboss;
  const r = 226 * s, g = 232 * s, b = 230 * s;
  c[0] = r; c[1] = g; c[2] = b;
  // green algae streaks hanging below each lap edge + overall grime toward the bottom
  const streak = fbm(x / 9, y / 260, 5, 43);
  const hang = (1 - sstep(0.05, 0.65, t + (streak - 0.5) * 0.6));
  const alg = clamp(hang * sstep(0.3, 0.7, streak) * 0.9 + sstep(0.5, 0.85, fbm(x / 90, y / 90, 4, 44)) * 0.45 + 0.18, 0, 0.92);
  const dirt = sstep(0.55, 1, y / H) * 0.35 * fbm(x / 50, y / 30, 4, 45);
  let dr = mix(r, r * 0.45 + 20, alg), dg = mix(g, g * 0.55 + 22, alg), db = mix(b, b * 0.32 + 10, alg);
  dr = mix(dr, 80, dirt); dg = mix(dg, 74, dirt); db = mix(db, 60, dirt);
  d[0] = dr; d[1] = dg; d[2] = db;
}

window.SURFACES = { driveway, brick, deck, siding };
window.renderSurface = (name) => render(window.SURFACES[name]);
window.SW = W; window.SH = H;
