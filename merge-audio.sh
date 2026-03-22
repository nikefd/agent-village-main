#!/bin/bash
set -e
cd /home/nikefd/agent-village

VIDEO=$(ls -t demo-video/*.webm | head -1)
VID_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
echo "📹 Video: $VIDEO (${VID_DUR}s)"

ffmpeg -y \
  -i "$VIDEO" \
  -i demo-audio/01-intro.mp3 \
  -i demo-audio/02-grid.mp3 \
  -i demo-audio/03-feed.mp3 \
  -i demo-audio/04-owner.mp3 \
  -i demo-audio/05-stranger.mp3 \
  -i demo-audio/06-feedcheck.mp3 \
  -i demo-audio/07-activity.mp3 \
  -i demo-audio/08-closing.mp3 \
  -filter_complex "
    [1:a]adelay=0|0[a1];
    [2:a]adelay=7500|7500[a2];
    [3:a]adelay=19000|19000[a3];
    [4:a]adelay=31000|31000[a4];
    [5:a]adelay=52000|52000[a5];
    [6:a]adelay=68000|68000[a6];
    [7:a]adelay=79000|79000[a7];
    [8:a]adelay=90000|90000[a8];
    [a1][a2][a3][a4][a5][a6][a7][a8]amix=inputs=8:dropout_transition=0:normalize=0[aout]
  " \
  -map 0:v -map "[aout]" \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  -shortest \
  demo.mp4 2>&1 | tail -3

echo ""
ls -lh demo.mp4
echo "✅ Done!"
