// server.js

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const runPuppeteer = require('./puppeteer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Rota POST para iniciar a live
app.post('/start', upload.single('video'), async (req, res) => {
  const { title, description, streamKey } = req.body;

  // Validação dos campos
  if (!title || !description || !streamKey) {
    return res.status(400).json({ success: false, error: 'Título, descrição e streamKey são obrigatórios.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Vídeo é obrigatório.' });
  }

  const videoPath = path.resolve(req.file.path);
  let steps = [];

  try {
    // PASSO 1: iniciar transmissão com FFmpeg
    const rtmpUrl = `rtmps://live-api-s.facebook.com:443/rtmp/${streamKey}`;
    const ffmpegArgs = ['-re', '-i', videoPath, '-f', 'flv', rtmpUrl];

    console.log(`Iniciando FFmpeg com: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    // Log stderr para debug
    ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      console.log(`[FFmpeg] ${msg}`);
    });

    ffmpegProcess.on('error', (error) => {
      console.error('Erro no FFmpeg:', error);
    });

    // Espera até detectar que FFmpeg iniciou de fato a transmissão
    await new Promise((resolve, reject) => {
      let started = false;

      ffmpegProcess.stderr.on('data', (data) => {
        const str = data.toString();

        // Detecta mensagem típica do FFmpeg indicando que está rodando
        if (!started && str.includes('Press [q] to stop')) {
          started = true;
          resolve();
        }

        // Detecta erros comuns e rejeita
        if (str.toLowerCase().includes('error')) {
          reject(new Error(`Erro detectado no FFmpeg: ${str}`));
        }
      });

      // Timeout para não travar indefinidamente (15s)
      setTimeout(() => {
        if (!started) {
          reject(new Error('FFmpeg não iniciou a transmissão dentro do tempo esperado.'));
        }
      }, 15000);
    });

    steps.push({ step: "Transmissão iniciada com FFmpeg", status: "OK" });
  } catch (err) {
    return res.json({ success: false, step: "FFmpeg", error: err.message });
  }

  try {
    // PASSO 2: automatizar preenchimento no Facebook via Puppeteer
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
