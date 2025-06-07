const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

// Multer salva os arquivos enviados em /tmp
const upload = multer({ dest: "/tmp" });

// Serve arquivos estáticos da pasta public (ex: index.html)
app.use(express.static("public"));

// 🔴 Sua chave personalizada do Facebook Live
const rtmpUrl = "rtmps://live-api-s.facebook.com:443/rtmp/FB-745433421335513-0-Ab2151bh5oex3yr_ADWG_rRV";

app.post("/upload", upload.single("video"), (req, res) => {
  const filePath = req.file.path;

  console.log(`🔴 Iniciando transmissão ao vivo para: ${rtmpUrl}`);

  // Comando FFmpeg para transmitir
  const ffmpeg = spawn("ffmpeg", [
    "-re",
    "-stream_loop", "-1",         // Loop infinito
    "-i", filePath,               // Caminho do vídeo
    "-t", "2400",                 // Duração total (40 minutos)
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-maxrate", "3000k",
    "-bufsize", "6000k",
    "-pix_fmt", "yuv420p",
    "-g", "50",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "44100",
    "-f", "flv",
    rtmpUrl                       // URL da live
  ]);

  // Log de erro FFmpeg
  ffmpeg.stderr.on("data", (data) => {
    console.log(`FFmpeg: ${data}`);
  });

  // Quando FFmpeg termina, limpa o arquivo temporário
  ffmpeg.on("close", (code) => {
    console.log(`⚠️ FFmpeg finalizado com código: ${code}`);
    fs.unlink(filePath, () => {}); // Exclui vídeo temporário
  });

  // Resposta para o navegador
  res.send("✅ Live iniciada por 40 minutos! Acesse sua transmissão no Facebook.");
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
