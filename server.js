const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const bodyParser = require('body-parser');
const AdmZip = require('adm-zip');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
// ZIP dosyası geleceği için limiti 500mb tutsak bile paket 5MB olacağı için sorun yok
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

app.get('/', (req, res) => {
    res.send('Stoic ZIP Motoru Aktif! 🚀');
});

app.post('/render', async (req, res) => {
    try {
        const { zipBase64, audioBase64, fps } = req.body;
        if (!zipBase64 || !audioBase64) return res.status(400).send('Eksik veri.');

        const sessionId = Date.now().toString();
        const tempDir = path.join(__dirname, sessionId);
        fs.mkdirSync(tempDir);

        // 1. Sesi Kaydet
        const audioBuffer = Buffer.from(audioBase64.split(',')[1], 'base64');
        const audioPath = path.join(tempDir, 'audio.mp3');
        fs.writeFileSync(audioPath, audioBuffer);

        // 2. Telefondan Gelen ZIP'i Aç ve Fotoğrafları Çıkar
        const zipBuffer = Buffer.from(zipBase64, 'base64');
        const zip = new AdmZip(zipBuffer);
        zip.extractAllTo(tempDir, true);

        const outputPath = path.join(tempDir, 'Stoic_Reels_Ultra.mp4');

        // 3. FFMPEG İle Full HD Birleştir
        ffmpeg()
            .input(path.join(tempDir, 'frame_%05d.jpg'))
            .inputOptions([`-framerate ${fps || 24}`])
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
                res.download(outputPath, 'Stoic_Reels_Ultra.mp4', () => {
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
    console.log(`Stoic ZIP Motoru ${port} portunda çalışıyor.`);
});
