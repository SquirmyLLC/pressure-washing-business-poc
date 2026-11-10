# Pressure Washing Business POC

An interactive website for a pressure washing business, built as a client demo.
The brand ("Brightline Pressure Washing"), prices, reviews, phone number, towns and media are placeholders.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/ (works from any folder or static host)
```

## What's interactive

- **Video hero**: a montage of real jobs in a tilted card, with a blurred copy filling the background (full-bleed on phones).
- **Scroll story**: a pinned section where scrolling scrubs through a real driveway time-lapse, through three steps: problem, wash, done.
- **Reels**: three short vertical clips that play as they scroll into view, with a counting stat.
- **Before/after**: a drag slider and a "wash it yourself" spray canvas (`src/spray.js`), both using real frames from the same static camera.
- **Service cards**: each card plays its clip on hover (on phones, as it scrolls into view).
- **Instant price calculator**, FAQ, and a front-end-only quote form.

## Media

`public/media` is cut from two sample phone videos with `tools/edit-videos.sh` (trimmed, cropped to remove watermarks and end screens, color-graded, audio removed).
**They are other companies' social posts, so replace them with the client's own footage (or get permission) before showing this as a client's site.**
To re-cut from new footage, adjust the timestamps in the script and run `tools/edit-videos.sh <driveway.mp4> <montage.mp4>` (needs ffmpeg).
v1 (procedurally generated placeholder art) is tagged `v1`.

## Not done yet

- Real brand, footage, prices, service area and reviews.
- The quote form doesn't send anywhere yet (hook up email/SMS or a CRM before launch).
