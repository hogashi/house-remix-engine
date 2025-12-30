# House Remix Engine

Professional audio studio with two powerful modes: BPM Fixer and House Remixer.

## Features

### Mode 1: BPM Fixer (Quantization Engine)
- Upload any audio file (MP3, WAV, etc.)
- Automatically fix drifting tempo to exact BPM
- Slice and stretch audio to align with the grid
- No drum loop required

### Mode 2: House Remixer
- Convert any song into a 126 BPM house track
- Professional sidechain compression effect
- Bass management with highpass filtering
- Automatic drum layering
- Requires 126 BPM drum loop

Both modes powered by FFmpeg and Node.js

## Prerequisites

- Node.js (v14 or higher)
- For Remixer mode only: A 126 BPM drum loop file (WAV format)

## Setup

1. Install dependencies:
```bash
npm install
```

2. For Remixer mode, place a 126 BPM drum loop at `./assets/drums.wav`:
```bash
# The assets directory is already created by the server
# Just place your drums.wav file there
cp /path/to/your/drums.wav ./assets/drums.wav
```

**Note**: BPM Fixer mode works without the drum loop file.

## Running the Server

```bash
npm start
```

The server will start at http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. Select your mode using the tabs:
   - **BPM Fixer**: For clean tempo correction
   - **Remixer**: For full house production
3. Drag and drop an audio file or click to select
4. Set target BPM (for BPM Fixer mode)
5. Click the process button
6. Wait for processing to complete
7. Your processed track will download automatically

## Technical Details

### BPM Fixer Pipeline
1. **Beat Detection**: Analyzes tempo variations in the original track
2. **Dynamic Warping**: Slices audio into segments
3. **Tempo Adjustment**: Stretches each segment to match target BPM
4. **Concatenation**: Seamlessly joins corrected segments

### Remixer Pipeline
1. **Highpass Filter**: Removes bass frequencies below 200Hz from the original song
2. **Sidechain Compression**: Creates the classic house music "pumping" effect
3. **Drum Layering**: Adds 126 BPM house drums
4. **Mix**: Combines all elements into final track

## Where to Get Drum Loops

For the Remixer mode, you need a 126 BPM drum loop. Here are some options:

1. **Free Resources**:
   - [Freesound.org](https://freesound.org/) - Search for "126 bpm house drums"
   - [Looperman.com](https://www.looperman.com/) - Free loops from producers
   - [LANDR Samples](https://samples.landr.com/) - Free sample packs

2. **Create Your Own**:
   - Use a DAW (Ableton, FL Studio, Logic Pro)
   - Set tempo to 126 BPM
   - Create a 4-8 bar drum pattern
   - Export as WAV

3. **Requirements**:
   - Must be WAV format
   - Should be exactly 126 BPM
   - Recommended: 4-8 bars in length
   - Stereo or mono both work

## Troubleshooting

**"Drum loop missing" error**:
- Only affects Remixer mode
- Ensure `./assets/drums.wav` exists
- File must be valid WAV format
- BPM Fixer mode works without drums

**Server won't start**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Processing takes too long**:
- Large files (>10MB) may take 30-60 seconds
- Complex filter chains require processing time
- Check server console for FFmpeg progress