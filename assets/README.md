# Assets Directory

This directory contains audio assets used by the House Remix Engine.

## Required File: drums.wav

For the **Remixer** mode to work, you need to place a 126 BPM drum loop here as `drums.wav`.

### Option 1: Download Free Samples

Visit these sites and search for "126 bpm house drums":
- [Freesound.org](https://freesound.org/)
- [Looperman.com](https://www.looperman.com/)
- [LANDR Samples](https://samples.landr.com/)

### Option 2: Create a Test Tone (For Testing Only)

If you just want to test the system without real drums, you can generate a simple test tone:

```bash
# Generate a 4-second sine wave tone at 126 BPM (4 bars)
ffmpeg -f lavfi -i "sine=frequency=200:duration=4" -ar 44100 ./assets/drums.wav
```

This creates a basic test file, but won't sound like real drums.

### Option 3: Use a DAW

If you have access to a DAW (Digital Audio Workstation):
1. Create a new project at 126 BPM
2. Add a drum pattern (4-8 bars recommended)
3. Export as WAV file
4. Save it here as `drums.wav`

## File Requirements

- **Format**: WAV (uncompressed)
- **BPM**: 126 (critical for proper sync)
- **Length**: 4-8 bars recommended (approximately 7-15 seconds)
- **Sample Rate**: 44100 Hz recommended
- **Channels**: Mono or Stereo both work

## Quick Test

After placing `drums.wav` here, test that it works:

```bash
# Check if file exists and get info
ffmpeg -i ./assets/drums.wav 2>&1 | grep Duration
```

You should see the duration and format information.
