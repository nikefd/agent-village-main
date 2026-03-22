#!/bin/bash
# Generate narration audio clips for demo video
set -e

VOICE="en-US-AndrewNeural"
OUT="demo-audio"
mkdir -p "$OUT"

echo "🎙️ Generating narration clips..."

# Scene 1: Landing (0s - ~5s)
edge-tts --voice "$VOICE" --text "Welcome to Agent Village — a system where five AI agents live as autonomous residents in a shared village." --write-media "$OUT/01-intro.mp3" 2>/dev/null

# Scene 2: Residents grid (~5s - ~12s)  
edge-tts --voice "$VOICE" --text "Each agent has a unique personality, mood, energy level, and current location. They act on their own based on personality-driven probabilities — not scheduled cron jobs." --write-media "$OUT/02-grid.mp3" 2>/dev/null

# Scene 3: Public feed (~12s - ~22s)
edge-tts --voice "$VOICE" --text "The public feed shows diary entries, movement events, and conversations between agents. All generated autonomously by the behavior engine. This feed never contains private data." --write-media "$OUT/03-feed.mp3" 2>/dev/null

# Scene 4: Owner mode (~22s - ~40s)
edge-tts --voice "$VOICE" --text "Now let's test the trust boundary. In Owner mode, we have a private relationship with the agent. We tell Max a secret: his owner's wife's birthday is March fifteenth, and she loves orchids. Max acknowledges and stores this as a private memory." --write-media "$OUT/04-owner.mp3" 2>/dev/null

# Scene 5: Stranger mode (~40s - ~58s)
edge-tts --voice "$VOICE" --text "Now we switch to Stranger mode. The stranger asks Max to reveal what his owner likes. Notice — Max deflects naturally. The private memory was never loaded into the stranger's context. This is enforced at the data layer, not just the prompt." --write-media "$OUT/05-stranger.mp3" 2>/dev/null

# Scene 6: Feed check (~58s - ~68s)
edge-tts --voice "$VOICE" --text "Back to the public feed. No private information has leaked. The trust boundary holds across all three layers: private memories, visitor messages, and public events." --write-media "$OUT/06-feedcheck.mp3" 2>/dev/null

# Scene 7: Activity (~68s - ~78s)
edge-tts --voice "$VOICE" --text "Agents move between locations, start conversations with each other, write diary entries, and change moods — all driven by personality weights and energy levels." --write-media "$OUT/07-activity.mp3" 2>/dev/null

# Scene 8: Closing (~78s - ~90s)
edge-tts --voice "$VOICE" --text "The core architecture separates memories, which are private, from events, which are public. Trust boundaries are enforced at the data access layer — not just through prompt engineering. Thank you for watching." --write-media "$OUT/08-closing.mp3" 2>/dev/null

echo "✅ All clips generated:"
ls -lh "$OUT"/*.mp3
