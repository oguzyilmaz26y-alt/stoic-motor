const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const bodyParser = require('body-parser');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const port = process.env.PORT || 10000;

// Telefonunla iletişim kurabilmesi için güvenlik izinleri
app.use(cors());
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

// Sunucu test linki
app.get('/', (req, res) => {
    res.send('Stoic Motor Aktif ve Göreve Hazır! 🚀');
});

// Telefonundan gelen fotoğrafları ve sesi birleştirip MP4 yapan merkez
app.post('/render', async (req, res) => {
    try {
        const { frames, audioBase64, fps } = req.body;
        if (!frames || !audioBase64) return res.status(400).send('Eksik veri gönderildi.');

        const sessionId = Date.now().toString();
        const tempDir = path.join(__dirname, sessionId);
        fs.mkdirSync(tempDir);

        // 1. Sesi Çöz ve Kaydet
        const audioBuffer = Buffer.from(audioBase64.split(',')[1], 'base64');
        const audioPath = path.join(tempDir, 'audio.mp3');
        fs.writeFileSync(audioPath, audioBuffer);

        // 2. Telefondan gelen kareleri (Fotoğrafları) kaydet
        frames.forEach((frameBase64, i) => {
            const frameBuffer = Buffer.from(frameBase64.split(',')[1], 'base64');
            const frameName = `frame_${i.toString().padStart(5, '0')}.jpg`;
            fs.writeFileSync(path.join(tempDir, frameName), frameBuffer);
        });

        const outputPath = path.join(tempDir, 'Stoic_Reels.mp4');

        // 3. FFMPEG ile Sıfır Kaymalı Birleştirme (Sunucu Gücüyle)
        ffmpeg()
            .input(path.join(tempDir, 'frame_%05d.jpg'))
            .inputOptions([`-framerate ${fps || 30}`])
            .input(audioPath)
            .outputOptions([
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-preset ultrafast',
                '-c:a aac',
                '-b:a 192k',
                '-shortest'
            ])
            .save(outputPath)
            .on('end', () => {
                // Videoyu telefona yolla ve sunucuyu temizle
                res.download(outputPath, 'Stoic_Reels.mp4', () => {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                });
            })
            .on('error', (err) => {
                console.error(err);
                res.status(500).send('Render hatası: ' + err.message);
                fs.rmSync(tempDir, { recursive: true, force: true });
            });

    } catch (err) {
        console.error(err);
        res.status(500).send('Sunucu hatası: ' + err.message);
    }
});

app.listen(port, () => {
    console.log(`Stoic Motor ${port} portunda çalışıyor.`);
});
