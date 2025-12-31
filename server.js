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
 */
const getBeatMap = (buffer) => {
    return new Promise((resolve, reject) => {
        const context = new AudioContext();
        context.decodeAudioData(buffer, (audioBuffer) => {
            const data = audioBuffer.getChannelData(0); 
            const mt = new MusicTempo(data);
            resolve(mt.beats);
        }, reject);
    });
};

/**
 * PRODUCT 1: BPM FIXER (Quantization Engine)
 * FIXED: Added asetpts to ensure concat doesn't fail after the first beat.
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

        // Limit the number of beats if the file is massive to prevent command-line length errors
        const maxBeats = Math.min(beats.length - 1, 400); 

        for (let i = 0; i < maxBeats; i++) {
            const start = beats[i];
            const originalDuration = beats[i + 1] - start;
            
            let ratio = originalDuration / targetBeatDuration;
            // Ratio is Original/Target. atempo expects Target/Original logic for speed? 
            // Actually atempo 2.0 means 2x speed. 
            // If originalDuration is 0.5 and target is 0.47, we need to speed up (ratio > 1).
            const speedFactor = originalDuration / targetBeatDuration;
            const finalSpeed = Math.max(0.5, Math.min(2.0, speedFactor));

            const label = `b${i}`;
            
            // TRIM -> STRETCH -> RESET TIMESTAMPS (Critical for concat)
            filterChain.push({
                filter: 'atrim',
                options: { start: start, duration: originalDuration },
                inputs: '0:a',
                outputs: `trim${label}`
            });

            filterChain.push({
                filter: 'atempo',
                options: finalSpeed,
                inputs: `trim${label}`,
                outputs: `stretch${label}`
            });

            filterChain.push({
                filter: 'asetpts',
                options: 'NTS',
                inputs: `stretch${label}`,
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
            .audioBitrate('192k')
            .on('start', (cmd) => console.log('Quantizing with timestamp sync...'))
            .on('end', () => {
                res.download(outputPath, () => {
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
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
 */
app.post('/remix', upload.single('song'), async (req, res) => {
    const inputPath = req.file.path;
    const drumPath = path.join(__dirname, 'assets', 'drums.wav');
    const outputPath = path.join(__dirname, 'remixes', `remix-${Date.now()}.mp3`);

    if (!fs.existsSync(drumPath)) return res.status(500).send("Drum loop missing in ./assets/drums.wav");

    ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return res.status(500).send("Could not probe file.");
        
        const duration = metadata.format.duration;

        ffmpeg()
            .input(inputPath)
            .input(drumPath)
            .inputOptions(['-stream_loop -1'])
            .complexFilter([
                { filter: 'highpass', options: { f: 200 }, inputs: '0:a', outputs: 'hpf' },
                { 
                  filter: 'sidechaincompress', 
                  options: { threshold: 0.1, ratio: 12, attack: 5, release: 120 }, 
                  inputs: ['hpf', '1:a'], 
                  outputs: 'ducked' 
                },
                { filter: 'amix', options: { inputs: 2, duration: 'first' }, inputs: ['ducked', '1:a'] }
            ])
            .duration(duration)
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