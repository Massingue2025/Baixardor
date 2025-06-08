const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const runPuppeteer = require('./puppeteer');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Rota principal: recebe título, descrição, vídeo e chave
app.post('/start', upload.single('video'), async (req, res) => {
  const { title, description, streamKey } = req.body;
  const videoPath = req.file.path;
  let steps = [];

  try {
    // PASSO 1: Transmitir com FFmpeg
    const rtmpUrl = `rtmp://live-api-s.facebook.com:80/rtmp/${streamKey}`;
    const ffmpegCmd = `ffmpeg -re -i ${videoPath} -f flv "${rtmpUrl}"`;
    exec(ffmpegCmd);
    steps.push({ step: "Transmissão iniciada com FFmpeg", status: "OK" });
  } catch (err) {
    return res.json({ success: false, step: "FFmpeg", error: err.message });
  }

  // Espera o Facebook detectar o stream
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    // PASSO 2: Abrir navegador invisível, preencher dados e iniciar live
    await runPuppeteer(title, description);
    steps.push({ step: "Live iniciada no Facebook com título e descrição", status: "OK" });
  } catch (err) {
    return res.json({ success: false, step: "Puppeteer", error: err.message });
  }

  steps.push({ step: "✅ Sua live está a ser transmitida agora!", status: "FINALIZADO" });
  res.json({ success: true, steps });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
