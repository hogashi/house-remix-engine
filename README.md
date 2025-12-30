# House Remix Engine

Convert any song into a 126 BPM House track with sidechain pumping and bass management.

## Features

- Upload any audio file (MP3, WAV, etc.)
- Automatic conversion to 126 BPM house music
- Professional sidechain compression effect
- Bass management with highpass filtering
- Powered by FFmpeg and Node.js

## Prerequisites

- Node.js (v14 or higher)
- A 126 BPM drum loop file (WAV format)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create the assets directory and add your drum loop:
```bash
mkdir -p assets
```

3. Place a 126 BPM drum loop file at `./assets/drums.wav`
   - The file must be in WAV format
   - Recommended: 4-8 bar house drum loop at exactly 126 BPM

## Running the Server

```bash
npm start
```

The server will start at http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. Drag and drop an audio file or click to select
3. Click "GENERATE REMIX"
4. Wait for processing to complete
5. Your remixed track will download automatically

## Technical Details

The audio processing pipeline:
1. **Highpass Filter**: Removes bass frequencies below 200Hz from the original song
2. **Sidechain Compression**: Creates the classic house music "pumping" effect
3. **Mix**: Combines the processed song with the 126 BPM drum loop

## Troubleshooting

If you see "Server missing drum assets", ensure:
- The `./assets/drums.wav` file exists
- The file is a valid WAV audio file
- The file is readable by the server