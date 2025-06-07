const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 10000;

const upload = multer({ dest: "/tmp" }); // Para compatibilidade com Render

app.use(express.static("public"));

// RTMP fixo no código
const rtmpUrl = "rtmps://live-api-s.facebook.com:443/rtmp/FB-744405664771622-0-Ab09qkJ-62nytCGG2NyDIwSl";

// Rota ping para manter o servidor vivo
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Função para enviar ping a cada intervalMs (default 60 segundos)
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
    "-stream_loop", "-1",      // repete infinitamente
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

  // Inicia o ping para manter servidor vivo
  const stopKeepAlive = startKeepAlivePing(60000); // 60 segundos

  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg terminou com código ${code}`);
    fs.unlink(filePath, () => {});
    stopKeepAlive(); // para os pings
  });

  res.send("Live iniciada por 40 minutos! Verifique sua transmissão no Facebook.");
});

app.listen(PORT, () => {
  console.log(`Servidor na porta ${PORT}`);
});
