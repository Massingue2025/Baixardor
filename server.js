const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

const upload = multer({ dest: "/tmp" }); // Render aceita /tmp

app.use(express.static("public"));

app.post("/upload", upload.single("video"), (req, res) => {
  const filePath = req.file.path;
  const rtmpUrl = process.env.RTMP_URL;

  if (!rtmpUrl) {
    return res.status(500).send("RTMP_URL não está definida.");
  }

  console.log(`Transmitindo para: ${rtmpUrl}`);

  // FFmpeg com looping infinito (-stream_loop -1) e limitando tempo total (-t 2400 = 40 min)
  const ffmpeg = spawn("ffmpeg", [
    "-re",
    "-stream_loop", "-1",
    "-i", filePath,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-maxrate", "3000k",
    "-bufsize", "6000k",
    "-pix_fmt", "yuv420p",
    "-g", "50",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "44100",
    "-t", "2400",        // 40 minutos em segundos
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
