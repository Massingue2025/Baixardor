const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 10000;

const upload = multer({ dest: "/tmp" }); // Compatível com Render

app.use(express.static("public"));

// ✅ Nova chave RTMP
const rtmpUrl = "rtmps://live-api-s.facebook.com:443/rtmp/FB-745433421335513-0-Ab2151bh5oex3yr_ADWG_rRV";

// Rota de ping interno
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Função para auto-ping a si mesmo
function startKeepAlivePing(intervalMs = 60000) {
  console.log(`Iniciando keep-alive ping a cada ${intervalMs / 1000} segundos.`);

  const intervalId = setInterval(() => {
    http.get(`http://localhost:${PORT}/ping`, (res) => {
      console.log(`Keep-alive ping respondido com status ${res.statusCode} em ${new Date().toISOString()}`);
    }).on("error", (err) => {
      console.error("Erro no keep-alive ping:", err.message);
    });
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
    console.log("Keep-alive ping parado.");
  };
}

app.post("/upload", upload.single("video"), (req, res) => {
  const filePath = req.file.path;

  console.log(`Transmitindo para: ${rtmpUrl}`);

  const ffmpeg = spawn("ffmpeg", [
    "-re",
    "-stream_loop", "-1",      // repete o vídeo infinitamente
    "-i", filePath,
    "-t", "2400",               // duração total de 40 minutos
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
    rtmpUrl
  ]);

  ffmpeg.stderr.on("data", (data) => {
    console.log(`FFmpeg: ${data}`);
  });

  // Inicia keep-alive ping
  const stopKeepAlive = startKeepAlivePing();

  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg terminou com código ${code}`);
    fs.unlink(filePath, () => {});
    stopKeepAlive(); // Para o keep-alive
  });

  res.send("Live iniciada por 40 minutos! Verifique sua transmissão no Facebook.");
});

app.listen(PORT, () => {
  console.log(`Servidor na porta ${PORT}`);
});
