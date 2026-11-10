// Generates the placeholder media in public/media: before/after image pairs for each
// surface and the wash.mp4 clip (+ poster). Needs Playwright's Chromium and ffmpeg.
// Usage: node tools/gen-media.mjs [--images-only|--video-only]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/media');
mkdirSync(out, { recursive: true });
const arg = process.argv[2] || '';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: readFileSync(join(root, 'tools/surfaces.js'), 'utf8') });
await page.addScriptTag({ content: readFileSync(join(root, 'tools/wash-video.js'), 'utf8') });

const save = (file, dataUrl) => writeFileSync(join(out, file), Buffer.from(dataUrl.split(',')[1], 'base64'));

if (arg !== '--video-only') {
  for (const name of ['driveway', 'brick', 'deck', 'siding']) {
    const [clean, dirty] = await page.evaluate((n) => {
      const { clean, dirty } = window.renderSurface(n);
      const enc = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); return c.toDataURL('image/jpeg', 0.84); };
      return [enc(clean), enc(dirty)];
    }, name);
    save(`${name}-after.jpg`, clean); save(`${name}-before.jpg`, dirty);
    console.log('surface', name);
  }
}

if (arg !== '--images-only') {
  const b64 = (f) => 'data:image/jpeg;base64,' + readFileSync(join(out, f)).toString('base64');
  await page.evaluate(async ([b, a]) => { window.R = await window.makeWashRenderer(b, a); }, [b64('driveway-before.jpg'), b64('driveway-after.jpg')]);
  const FPS = 30, DUR = 12, tmp = mkdtempSync(join(tmpdir(), 'wash-'));
  for (let f = 0; f < FPS * DUR; f++) {
    const url = await page.evaluate((t) => window.R.frame(t), f / FPS);
    writeFileSync(join(tmp, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    if (f === FPS * 5) writeFileSync(join(out, 'wash.jpg'), Buffer.from(url.split(',')[1], 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', '-an', join(out, 'wash.mp4')]);
  rmSync(tmp, { recursive: true, force: true });
  console.log('video wash.mp4');
}
await browser.close();
