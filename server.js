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

        for (let i = 0; i < beats.length - 1; i++) {
            const start = beats[i];
            const originalDuration = beats[i + 1] - start;
            
            let ratio = originalDuration / targetBeatDuration;
            ratio = Math.max(0.5, Math.min(2.0, ratio));

            const label = `b${i}`;
            
            filterChain.push({
                filter: 'atrim',
                options: { start: start, duration: originalDuration },
                inputs: '0:a',
                outputs: `t${label}`
            });

            filterChain.push({
                filter: 'atempo',
                options: ratio,
                inputs: `t${label}`,
                outputs: label
            });

            concatInputs.push(label);
        }

        filterChain.push({
            filter: 'concat',
            options: { n: concatInputs.length, v: 0, a: 1 },
            inputs: concatInputs,
            outputs: 'fixed_audio'
        });

        ffmpeg(inputPath)
            .complexFilter(filterChain, 'fixed_audio')
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
 * Fixed: Now correctly uses the song's duration and ensures drums loop properly.
 */
app.post('/remix', upload.single('song'), async (req, res) => {
    const inputPath = req.file.path;
    const drumPath = path.join(__dirname, 'assets', 'drums.wav');
    const outputPath = path.join(__dirname, 'remixes', `remix-${Date.now()}.mp3`);

    if (!fs.existsSync(drumPath)) return res.status(500).send("Drum loop missing in ./assets/drums.wav");

    // We first probe the input to get the exact duration to force the output length
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return res.status(500).send("Could not probe file.");
        
        const duration = metadata.format.duration;

        ffmpeg()
            .input(inputPath)
            // The -stream_loop -1 must come BEFORE the input to work correctly in all versions
            .input(drumPath)
            .inputOptions(['-stream_loop -1'])
            .complexFilter([
                // 1. Highpass original song
                { 
                    filter: 'highpass', 
                    options: { f: 200 }, 
                    inputs: '0:a', 
                    outputs: 'hpf' 
                },
                // 2. Sidechain: Duck the hpf song based on the drum's volume
                { 
                  filter: 'sidechaincompress', 
                  options: { threshold: 0.1, ratio: 12, attack: 5, release: 120 }, 
                  inputs: ['hpf', '1:a'], 
                  outputs: 'ducked' 
                },
                // 3. Mix ducked song with the drums
                // We set duration to 'shortest' but we loop the drums infinitely, 
                // so we use -t (duration) on the output to match the original song exactly.
                { 
                    filter: 'amix', 
                    options: { inputs: 2, duration: 'shortest' }, 
                    inputs: ['ducked', '1:a'] 
                }
            ])
            .duration(duration) // Explicitly force the output to match the input song's length
            .audioBitrate('192k')
            .on('end', () => {
                res.download(outputPath, () => {
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                });
            })
            .on('error', (err) => {
                console.error(err);
                res.status(500).send(err.message);
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            })
            .save(outputPath);
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Audio Studio running on port ${PORT}`));