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
// multer já parseia multipart/form-data, mas para json puro:
app.use(express.json());

// Rota principal: recebe título, descrição, vídeo e chave (via form-data)
app.post('/start', upload.single('video'), async (req, res) => {
  const { title, description, streamKey } = req.body;

  if (!title || !description || !streamKey) {
    return res.status(400).json({ success: false, error: 'Título, descrição e streamKey são obrigatórios.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Vídeo é obrigatório.' });
  }

  const videoPath = path.resolve(req.file.path);
  let steps = [];

  try {
    // PASSO 1: Iniciar transmissão com FFmpeg via spawn para controle do processo
    const rtmpUrl = `rtmp://live-api-s.facebook.com:80/rtmp/${streamKey}`;
    const ffmpegArgs = ['-re', '-i', videoPath, '-f', 'flv', rtmpUrl];
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    // Captura erros e saída para debugging
    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`[FFmpeg] ${data}`);
    });

    ffmpegProcess.on('error', (error) => {
      console.error('Erro no FFmpeg:', error);
    });

    // Espera um pouco para garantir que o ffmpeg iniciou e enviou stream
    await new Promise((resolve, reject) => {
      let started = false;
      ffmpegProcess.stderr.on('data', (data) => {
        const str = data.toString();
        // Pode customizar a detecção de "Press [q] to stop" ou outro texto do ffmpeg
        if (!started && str.includes('Press [q] to stop')) {
          started = true;
          resolve();
        }
      });
      // Timeout fallback (exemplo 10s)
      setTimeout(() => {
        if (!started) {
          reject(new Error('FFmpeg não iniciou corretamente a transmissão'));
        }
      }, 10000);
    });

    steps.push({ step: "Transmissão iniciada com FFmpeg", status: "OK" });

  } catch (err) {
    return res.json({ success: false, step: "FFmpeg", error: err.message });
  }

  try {
    // PASSO 2: Abrir navegador invisível, preencher título e descrição, iniciar live
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
