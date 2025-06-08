const puppeteer = require("puppeteer");

async function launchFacebookLive(title, description) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Acessa diretamente a página de criação de live
  await page.goto("https://www.facebook.com/live/producer", { waitUntil: "networkidle2" });

  // Aguarda os campos aparecerem
  await page.waitForSelector('[aria-label="Título da transmissão ao vivo"]', { timeout: 60000 });
  await page.type('[aria-label="Título da transmissão ao vivo"]', title);
  await page.type('[aria-label="Diga algo sobre este vídeo ao vivo..."]', description);

  // Iniciar a live (botão pode variar, verificar pelo DevTools se necessário)
  const startButton = await page.$x("//span[contains(text(), 'Iniciar transmissão ao vivo')]");
  if (startButton.length > 0) {
    await startButton[0].click();
    console.log("Live iniciada via interface.");
  } else {
    throw new Error("Botão de iniciar live não encontrado.");
  }

  // Não fecha o navegador para manter a live ativa
}

module.exports = { launchFacebookLive };
