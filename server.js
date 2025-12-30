const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const MusicTempo = require('music-tempo');
const { AudioContext } = require('web-audio-api');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure directories exist
const dirs = ['./uploads', './remixes', './assets'];
dirs.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir); });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * HELPER: Automated Beat Mapping
 * Analyzes an audio buffer to find beat timestamps.
 */
const getBeatMap = (buffer) => {
    return new Promise((resolve, reject) => {
        const context = new AudioContext();
        context.decodeAudioData(buffer, (audioBuffer) => {
            const data = audioBuffer.getChannelData(0); // Use Mono for detection
            const mt = new MusicTempo(data);
            // mt.beats is an array of timestamps where beats occur
            resolve(mt.beats);
        }, reject);
    });
};

/**
 * PRODUCT 1: BPM FIXER (Quantization Engine)
 * Now uses REAL beat detection and dynamic slicing.
 */
app.post('/fix-bpm', upload.single('song'), async (req, res) => {
    const inputPath = req.file.path;
    const targetBpm = parseFloat(req.body.targetBpm) || 126;
    const outputPath = path.join(__dirname, 'remixes', `fixed-${Date.now()}.mp3`);
    
    const targetBeatDuration = 60 / targetBpm;

    try {
        const fileBuffer = fs.readFileSync(inputPath);
        const beats = await getBeatMap(fileBuffer);

        if (beats.length < 2) {
            throw new Error("Could not detect enough beats to quantize.");
        }

        let filterChain = [];
        let concatInputs = [];

        // Build a dynamic stretch filter for every detected beat interval
        for (let i = 0; i < beats.length - 1; i++) {
            const start = beats[i];
            const originalDuration = beats[i + 1] - start;
            
            // Handle edge case where tempo might be too fast/slow for atempo filter (0.5 to 2.0)
            let ratio = originalDuration / targetBeatDuration;
            ratio = Math.max(0.5, Math.min(2.0, ratio));

            const label = `b${i}`;
            
            // Trim the specific beat
            filterChain.push({
                filter: 'atrim',
                options: { start: start, duration: originalDuration },
                inputs: '0:a',
                outputs: `t${label}`
            });

            // Stretch the beat to the grid
            filterChain.push({
                filter: 'atempo',
                options: ratio,
                inputs: `t${label}`,
                outputs: label
            });

            concatInputs.push(label);
        }

        // Stitch the beats back together
        filterChain.push({
            filter: 'concat',
            options: { n: concatInputs.length, v: 0, a: 1 },
            inputs: concatInputs,
            outputs: 'fixed_audio'
        });

        ffmpeg(inputPath)
            .complexFilter(filterChain, 'fixed_audio')
            .on('start', (cmd) => console.log('Quantizing with detected beats...'))
            .on('end', () => {
                res.download(outputPath, () => {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                });
            })
            .on('error', (err) => {
                console.error(err);
                res.status(500).send("Quantization failed: " + err.message);
                if(fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            })
            .save(outputPath);

    } catch (err) {
        console.error(err);
        res.status(500).send("Analysis Error: " + err.message);
    }
});

/**
 * PRODUCT 2: REMIXER
 * Full House production: Warping + High-Pass + Sidechain + Drum Layering.
 */
app.post('/remix', upload.single('song'), async (req, res) => {
    const inputPath = req.file.path;
    const drumPath = path.join(__dirname, 'assets', 'drums.wav');
    const outputPath = path.join(__dirname, 'remixes', `remix-${Date.now()}.mp3`);

    if (!fs.existsSync(drumPath)) return res.status(500).send("Drum loop missing in ./assets/drums.wav");

    ffmpeg()
        .input(inputPath)
        .input(drumPath)
        .inputOptions(['-stream_loop -1'])
        .complexFilter([
            { filter: 'highpass', options: { f: 200 }, inputs: '0:a', outputs: 'hpf' },
            { 
              filter: 'sidechaincompress', 
              options: { threshold: 0.1, ratio: 12, release: 120 }, 
              inputs: ['hpf', '1:a'], 
              outputs: 'ducked' 
            },
            { filter: 'amix', options: { inputs: 2, duration: 'first' }, inputs: ['ducked', '1:a'] }
        ])
        .audioBitrate('192k')
        .on('end', () => {
            res.download(outputPath, () => {
                fs.unlinkSync(inputPath);
                fs.unlinkSync(outputPath);
            });
        })
        .on('error', (err) => res.status(500).send(err.message))
        .save(outputPath);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Audio Studio running on port ${PORT}`));