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

// ✅ Chave RTMP atualizada
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

  console.log(`📡 Iniciando transmissão para: ${rtmpUrl}`);
  const ffmpeg = spawn("ffmpeg", [
    "-re",
    "-stream_loop", "-1",
    "-i", filePath,
    "-t", "2400",
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
    console.log(`🔚 FFmpeg finalizado com código ${code}`);
  });

  // ✅ Aguarda 10 segundos para garantir que sinal chegou ao Facebook
  console.log("⏳ Aguardando 10 segundos para o Facebook detectar o vídeo...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // ✅ Agora inicia o navegador e configura a live
  try {
    console.log("🧭 Iniciando Puppeteer para configurar a live...");
    await launchFacebookLive(titulo, descricao);
    console.log("✅ Live iniciada com sucesso no Facebook!");
    res.send("Live iniciada com sucesso no Facebook!");
  } catch (e) {
    console.error("❌ Erro ao configurar a live:", e);
    res.status(500).send("Erro ao configurar a live.");
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
