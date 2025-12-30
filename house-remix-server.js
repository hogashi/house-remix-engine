const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

// Setup FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure directories exist
const dirs = ['./uploads', './remixes', './assets'];
dirs.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir); });

/**
 * Note: You must place a 126 BPM house drum loop in ./assets/drums.wav
 * for this script to work perfectly. 
 */

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/remix', upload.single('song'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const inputPath = req.file.path;
    const outputPath = path.join(__dirname, 'remixes', `remix-${Date.now()}.mp3`);
    const drumPath = path.join(__dirname, 'assets', 'drums.wav');

    // Default 126 BPM drum path check
    if (!fs.existsSync(drumPath)) {
        console.warn("Drums not found at ./assets/drums.wav. Ensure you have a 126BPM loop there.");
        return res.status(500).send("Server missing drum assets.");
    }

    try {
        /**
         * The Audio Pipeline:
         * 1. Highpass Filter: Cuts original song at 200Hz to make room for kick.
         * 2. Sidechain Compress: input[0] (song) ducks when input[1] (drums) hits.
         * 3. Amix: Merges the ducked song with the drums.
         */
        
        ffmpeg()
            .input(inputPath)
            .input(drumPath)
            .inputOptions(['-stream_loop -1']) // Loop drums to match song length
            .complexFilter([
                // Remove bass from original song
                {
                    filter: 'highpass',
                    options: { f: 200 },
                    inputs: '0:a',
                    outputs: 'filtered'
                },
                // Sidechain: song (filtered) ducks under drums (1:a)
                {
                    filter: 'sidechaincompress',
                    options: {
                        threshold: 0.1,
                        ratio: 12,
                        attack: 5,
                        release: 120
                    },
                    inputs: ['filtered', '1:a'],
                    outputs: 'ducked'
                },
                // Mix ducked song with the drums
                {
                    filter: 'amix',
                    options: { inputs: 2, duration: 'first' },
                    inputs: ['ducked', '1:a']
                }
            ])
            .audioBitrate('192k')
            .save(outputPath)
            .on('start', (cmd) => console.log('Started FFmpeg with: ' + cmd))
            .on('end', () => {
                res.download(outputPath, 'remix.mp3', () => {
                    // Cleanup temp files
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                });
            })
            .on('error', (err) => {
                console.error('FFmpeg Error:', err);
                res.status(500).send('FFmpeg processing failed.');
                if(fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Internal server error.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    🚀 House Remix Server running at http://localhost:${PORT}
    
    1. Ensure ffmpeg-static is installed.
    2. Place your 126BPM drum loop at ./assets/drums.wav
    3. Upload any song to get the house vibe!
    `);
});