const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const { launchFacebookLive } = require("./launchLive");

const app = express();
const PORT = process.env.PORT || 10000;

const upload = multer({ dest: "/tmp" });

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// ✅ Nova chave RTMP da transmissão
const rtmpUrl = "rtmps://live-api-s.facebook.com:443/rtmp/FB-1249889596922361-0-Ab3Dh9P1KomBRVPaQdhiGfC9";

app.get("/ping", (req, res) => res.status(200).send("pong"));

function startKeepAlivePing(intervalMs = 60000) {
  const intervalId = setInterval(() => {
    http.get(`http://localhost:${PORT}/ping`);
  }, intervalMs);
  return () => clearInterval(intervalId);
}

app.post("/upload", upload.single("video"), async (req, res) => {
  const filePath = req.file.path;
  const { titulo, descricao } = req.body;

  // Inicia navegador invisível e configura live
  try {
    await launchFacebookLive(titulo, descricao);
  } catch (e) {
    console.error("Erro no Puppeteer:", e);
    return res.status(500).send("Erro ao configurar a live.");
  }

  console.log(`Transmitindo para: ${rtmpUrl}`);
  const ffmpeg = spawn("ffmpeg", [
    "-re",
    "-stream_loop", "-1",
    "-i", filePath,
    "-t", "2400", // até 40 minutos
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
    rtmpUrl,
  ]);

  const stopKeepAlive = startKeepAlivePing();

  ffmpeg.stderr.on("data", (data) => console.log(`FFmpeg: ${data}`));

  ffmpeg.on("close", (code) => {
    fs.unlink(filePath, () => {});
    stopKeepAlive();
    console.log(`FFmpeg finalizado com código ${code}`);
  });

  res.send("Live iniciada com sucesso no Facebook!");
});

app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
