const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const runPuppeteer = require('./puppeteer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

app.post('/start', upload.single('video'), async (req, res) => {
  const { title, description, streamKey } = req.body;

  if (!title || !description || !streamKey) {
    if (req.file) cleanupFile(req.file.path);
    return res.status(400).json({ success: false, error: 'Título, descrição e streamKey são obrigatórios.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Vídeo é obrigatório.' });
  }

  const videoPath = path.resolve(req.file.path);
  let steps = [];
  let ffmpegProcess;

  // Função para apagar arquivo de forma segura
  function cleanupFile(filePath) {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Erro ao excluir arquivo temporário ${filePath}:`, err);
      else console.log(`Arquivo temporário ${filePath} removido com sucesso.`);
    });
  }

  // Função para finalizar FFmpeg se estiver rodando
  function killFFmpeg() {
    if (ffmpegProcess && !ffmpegProcess.killed) {
      console.log('Finalizando processo FFmpeg...');
      ffmpegProcess.kill('SIGINT'); // ou 'SIGTERM'
    }
  }

  try {
    const rtmpUrl = `rtmps://live-api-s.facebook.com:443/rtmp/${streamKey}`;
    const ffmpegArgs = ['-re', '-i', videoPath, '-f', 'flv', rtmpUrl];

    console.log(`Iniciando FFmpeg com: ffmpeg ${ffmpegArgs.join(' ')}`);

    ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    let started = false;

    const ffmpegStarted = new Promise((resolve, reject) => {
      ffmpegProcess.stderr.on('data', (data) => {
        const str = data.toString();
        console.log(`[FFmpeg] ${str}`);

        if (!started && str.includes('Press [q] to stop')) {
          started = true;
          resolve();
        }

        if (str.toLowerCase().includes('error')) {
          reject(new Error(`Erro detectado no FFmpeg: ${str}`));
        }
      });

      setTimeout(() => {
        if (!started) {
          reject(new Error('FFmpeg não iniciou a transmissão dentro do tempo esperado.'));
        }
      }, 15000);
    });

    await ffmpegStarted;

    // Captura quando o processo FFmpeg termina (exemplo: live finalizada)
    ffmpegProcess.on('exit', (code, signal) => {
      console.log(`FFmpeg saiu (code: ${code}, signal: ${signal})`);
      cleanupFile(videoPath);
    });

    // Caso o servidor seja fechado ou a requisição seja abortada, limpa e mata FFmpeg
    req.on('close', () => {
      console.log('Requisição abortada, finalizando FFmpeg e limpando arquivo.');
      killFFmpeg();
      cleanupFile(videoPath);
    });

    steps.push({ step: "Transmissão iniciada com FFmpeg", status: "OK" });

  } catch (err) {
    killFFmpeg();
    cleanupFile(videoPath);
    return res.json({ success: false, step: "FFmpeg", error: err.message });
  }

  try {
    await runPuppeteer(title, description);
    steps.push({ step: "Live iniciada no Facebook com título e descrição", status: "OK" });
  } catch (err) {
    killFFmpeg();
    cleanupFile(videoPath);
    return res.json({ success: false, step: "Puppeteer", error: err.message });
  }

  steps.push({ step: "✅ Sua live está a ser transmitida agora!", status: "FINALIZADO" });
  res.json({ success: true, steps });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
