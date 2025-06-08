const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 10000;
const upload = multer({ dest: "/tmp" });

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const rtmpUrl = "rtmps://live-api-s.facebook.com:443/rtmp/FB-1249889596922361-0-Ab3Dh9P1KomBRVPaQdhiGfC9";
const fbLiveUrl = "https://www.facebook.com/live/producer";

app.get("/ping", (req, res) => res.status(200).send("pong"));

function startKeepAlivePing(intervalMs = 60000) {
  const intervalId = setInterval(() => {
    http.get(`http://localhost:${PORT}/ping`, (res) => {
      console.log(`Ping respondido: ${res.statusCode}`);
    }).on("error", (err) => {
      console.error("Erro no ping:", err.message);
    });
  }, intervalMs);
  return () => clearInterval(intervalId);
}

async function iniciarLiveNoFacebook(titulo, descricao) {
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: "./cache",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    await page.goto(fbLiveUrl, { waitUntil: "networkidle2" });

    await page.waitForSelector('input[placeholder="Título da transmissão"]', { timeout: 15000 });
    await page.evaluate(() => {
      document.querySelector('input[placeholder="Título da transmissão"]').value = "";
      document.querySelector('textarea[placeholder="Diga às pessoas sobre sua transmissão ao vivo"]').value = "";
    });

    await page.type('input[placeholder="Título da transmissão"]', titulo, { delay: 50 });
    await page.type('textarea[placeholder="Diga às pessoas sobre sua transmissão ao vivo"]', descricao, { delay: 50 });

    const [btn] = await page.$x("//span[contains(text(),'Transmitir ao vivo')]");
    if (btn) {
      await btn.click();
      console.log("✅ Live iniciada no Facebook.");
    } else {
      console.log("⚠️ Botão 'Transmitir ao vivo' não encontrado.");
    }

    await page.waitForTimeout(5000);
  } catch (err) {
    console.error("Erro no Puppeteer:", err);
  } finally {
    await browser.close();
  }
}

app.post("/upload", upload.single("video"), async (req, res) => {
  const filePath = req.file.path;
  const titulo = req.body.titulo || "Live Automática";
  const descricao = req.body.descricao || "Live enviada com Node.js + FFmpeg";

  console.log(`Transmitindo para: ${rtmpUrl}`);

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
    rtmpUrl
  ]);

  ffmpeg.stderr.on("data", (data) => {
    console.log(`FFmpeg: ${data}`);
  });

  const stopPing = startKeepAlivePing();

  ffmpeg.on("close", () => {
    console.log("🚫 FFmpeg finalizado.");
    fs.unlink(filePath, () => {});
    stopPing();
  });

  await iniciarLiveNoFacebook(titulo, descricao);
  res.send("🎥 Live iniciada com sucesso! Verifique o Facebook.");
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
