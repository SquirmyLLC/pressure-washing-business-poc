#!/usr/bin/env bash
# Cuts the site's media from the two source clips Alex supplied (vertical phone videos).
# Trims, crops out the TikTok watermarks and end screens, color-matches the site, drops audio.
# Usage: tools/edit-videos.sh <driveway-timelapse.mp4> <cinematic-montage.mp4>
#   driveway  = 720x1280 timelapse of a driveway being washed (static camera)
#   cinematic = 576x1024 montage of house/roof/porch washing
# NOTE: both sources are other companies' social posts. Get permission or replace before client use.
set -euo pipefail
A=${1:?driveway clip}; B=${2:?cinematic clip}
OUT=public/media; mkdir -p "$OUT"
ENC=(-an -c:v libx264 -pix_fmt yuv420p -profile:v main -movflags +faststart -preset slow)
# overcast footage: more contrast and color, slightly cooler shadows to sit with the navy UI
GRADE_A="eq=contrast=1.12:saturation=1.2:brightness=0.01,colorbalance=bs=0.05:bm=0.02:rh=0.02,unsharp=5:5:0.35"
# already cinematic: just nudge the shadows toward the site's blue
GRADE_B="eq=contrast=1.05:saturation=1.05,colorbalance=bs=0.05:rs=-0.02:rh=0.015"
# driveway crop: keep y 9%..90% (watermark sits top-left early, bottom-right later)
CROP_A="crop=720:1036:0:116"
# cinematic: watermark is mid-left until ~4.8s, then bottom-right (y 76-86%)
CROP_B_TOP="crop=576:756:0:0"   # 3:4, everything above the bottom-right watermark


# 1) hero montage (3:4), hard cuts on the action, ~10s seamless loop
ffmpeg -y -loglevel error -i "$B" -filter_complex "\
[0]trim=9.4:11.2,setpts=PTS-STARTPTS[a];\
[0]trim=5.6:7.35,setpts=PTS-STARTPTS[b];\
[0]trim=11.5:13.7,setpts=PTS-STARTPTS[c];\
[0]trim=7.6:9.2,setpts=PTS-STARTPTS[d];\
[0]trim=16.6:19.4,setpts=PTS-STARTPTS[e];\
[a][b][c][d][e]concat=n=5:v=1,$CROP_B_TOP,$GRADE_B,fps=30[v]" -map "[v]" "${ENC[@]}" -crf 23 "$OUT/hero.mp4"
ffmpeg -y -loglevel error -ss 0.6 -i "$OUT/hero.mp4" -frames:v 1 -q:v 3 "$OUT/hero.jpg"

# 2) scroll-scrubbed driveway wash: frequent keyframes so seeking is smooth
ffmpeg -y -loglevel error -i "$A" -filter_complex "\
[0]trim=0.5:22.3,setpts=PTS-STARTPTS[a];[0]trim=22.95:23.9,setpts=PTS-STARTPTS[b];\
[a][b]concat=n=2:v=1,$CROP_A,$GRADE_A,scale=480:-2,fps=24[v]" -map "[v]" "${ENC[@]}" -crf 29 -g 6 -keyint_min 6 -sc_threshold 0 "$OUT/driveway-scrub.mp4"

# 3) real before/after stills from the same static camera
ffmpeg -y -loglevel error -ss 0.7 -i "$A" -frames:v 1 -vf "$CROP_A,$GRADE_A" -q:v 2 "$OUT/driveway-before.jpg"
ffmpeg -y -loglevel error -ss 23.4 -i "$A" -frames:v 1 -vf "$CROP_A,$GRADE_A" -q:v 2 "$OUT/driveway-after.jpg"

# 4) service card loops (5:4), played on hover / when in view
card() { # src start end y name grade w h
  ffmpeg -y -loglevel error -i "$1" -vf "trim=$2:$3,setpts=PTS-STARTPTS,crop=$7:$8:0:$4,$6,fps=30" "${ENC[@]}" -crf 24 "$OUT/card-$5.mp4"
  ffmpeg -y -loglevel error -ss 0.5 -i "$OUT/card-$5.mp4" -frames:v 1 -q:v 3 "$OUT/card-$5.jpg"
}
card "$A" 17.0 21.6 300 driveway "$GRADE_A,setpts=PTS/1.0" 720 576
card "$B" 9.4 11.3 120 house "$GRADE_B" 576 460
card "$B" 5.6 7.35 300 roof "$GRADE_B" 576 460
card "$B" 7.6 9.2 160 porch "$GRADE_B" 576 460

# 5) "watch it work" vertical reels (3:4)
ffmpeg -y -loglevel error -i "$B" -vf "trim=13.9:16.4,setpts=PTS-STARTPTS,delogo=x=372:y=770:w=200:h=100,crop=576:768:0:256,$GRADE_B" "${ENC[@]}" -crf 23 "$OUT/reel-patio.mp4"
ffmpeg -y -loglevel error -i "$B" -vf "trim=16.6:19.9,setpts=PTS-STARTPTS,$CROP_B_TOP,$GRADE_B" "${ENC[@]}" -crf 23 "$OUT/reel-aerial.mp4"
ffmpeg -y -loglevel error -i "$A" -vf "trim=2.0:14.0,setpts=PTS-STARTPTS,$CROP_A,$GRADE_A,setpts=PTS/2,scale=576:-2,crop=576:768:0:(ih-768)/2,fps=30" "${ENC[@]}" -crf 23 "$OUT/reel-driveway.mp4"
for r in patio aerial driveway; do ffmpeg -y -loglevel error -ss 0.3 -i "$OUT/reel-$r.mp4" -frames:v 1 -q:v 3 "$OUT/reel-$r.jpg"; done
echo done
