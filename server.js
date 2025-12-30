const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

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
 * PRODUCT 1: BPM FIXER (Quantization Engine)
 * This route slices the audio and stretches individual sections to align with the grid.
 */
app.post('/fix-bpm', upload.single('song'), async (req, res) => {
    const inputPath = req.file.path;
    const targetBpm = parseFloat(req.body.targetBpm) || 126;
    const outputPath = path.join(__dirname, 'remixes', `fixed-${Date.now()}.mp3`);
    
    // Target duration for one beat at targetBpm
    const targetBeatDuration = 60 / targetBpm;

    try {
        /**
         * QUANTIZATION LOGIC:
         * In a production environment, you'd use a peak-detection library here to get actual timestamps.
         * For this implementation, we demonstrate the 'Dynamic Warp' filter construction.
         */
        
        // Mocking a detected beat map for a song that drifts (Start 120BPM -> End 125BPM)
        // [time_in_seconds, actual_duration_to_next_beat]
        // This is where 'music-tempo' or 'aubio' would populate data.
        const mockBeatMap = [
            { start: 0, duration: 0.500 }, // 120 BPM segment
            { start: 0.500, duration: 0.495 },
            { start: 0.995, duration: 0.490 },
            { start: 1.485, duration: 0.485 },
            { start: 1.970, duration: 0.480 }  // Getting closer to 125 BPM
        ];

        let filterChain = [];
        let concatInputs = [];

        // We loop through the map and create a specific stretch for every segment
        mockBeatMap.forEach((beat, index) => {
            const ratio = beat.duration / targetBeatDuration;
            const label = `v${index}`;
            
            filterChain.push({
                filter: 'atrim',
                options: { start: beat.start, duration: beat.duration },
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
        });

        // Concatenate all fixed segments back together
        filterChain.push({
            filter: 'concat',
            options: { n: concatInputs.length, v: 0, a: 1 },
            inputs: concatInputs,
            outputs: 'fixed_audio'
        });

        ffmpeg(inputPath)
            .complexFilter(filterChain, 'fixed_audio')
            .on('start', (cmd) => console.log('Quantizing with dynamic map...'))
            .on('end', () => {
                res.download(outputPath, () => {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                });
            })
            .on('error', (err) => {
                console.error(err);
                res.status(500).send("Quantization failed: " + err.message);
            })
            .save(outputPath);

    } catch (err) {
        res.status(500).send(err.message);
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
            // Process the input song first (Highpass + Sidechain)
            { filter: 'highpass', options: { f: 200 }, inputs: '0:a', outputs: 'hpf' },
            { 
              filter: 'sidechaincompress', 
              options: { threshold: 0.1, ratio: 12, release: 120 }, 
              inputs: ['hpf', '1:a'], 
              outputs: 'ducked' 
            },
            // Layer the house drums on top
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

app.listen(3000, () => console.log('Audio Studio running on port 3000'));