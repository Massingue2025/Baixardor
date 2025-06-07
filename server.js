const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

const upload = multer({ dest: "/tmp" }); // Para compatibilidade com Render

app.use(express.static("public"));

// RTMP fixo no código
const rtmpUrl = "rtmps://live-api-s.facebook.com:443/rtmp/FB-744405664771622-0-Ab09qkJ-62nytCGG2NyDIwSl";

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

  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg terminou com código ${code}`);
    fs.unlink(filePath, () => {});
  });

  res.send("Live iniciada por 40 minutos! Verifique sua transmissão no Facebook.");
});

app.listen(PORT, () => {
  console.log(`Servidor na porta ${PORT}`);
});
