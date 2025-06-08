const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.resolve(__dirname, "fb_cookies.json");
const FB_LIVE_URL = "https://www.facebook.com/live/producer";

// Função que carrega cookies salvos da sessão (para não precisar login toda vez)
async function loadCookies(page) {
  if (fs.existsSync(COOKIES_PATH)) {
    const cookiesString = fs.readFileSync(COOKIES_PATH);
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    console.log("Cookies carregados com sucesso.");
  } else {
    console.warn("Arquivo de cookies não encontrado. Login manual necessário.");
  }
}

// Salva cookies após login manual (opcional para futuras execuções)
async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log("Cookies salvos.");
}

async function launchFacebookLive(titulo, descricao) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process", // talvez precise comentar se causar problema
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Carregar cookies para manter login já ativo
    await page.goto("https://www.facebook.com");
    await loadCookies(page);
    await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });

    // Navegar para o Facebook Live Producer
    await page.goto(FB_LIVE_URL, { waitUntil: "networkidle0" });

    // Verifica se está logado (exemplo: checar botão de criar live)
    const loginCheck = await page.$('div[aria-label="Criar vídeo ao vivo"]');
    if (!loginCheck) {
      throw new Error("Usuário não está logado no Facebook. Faça login manualmente.");
    }

    // Aguardar o campo do título estar visível
    await page.waitForSelector('textarea[aria-label="Título da transmissão ao vivo"]', { timeout: 10000 });
    await page.focus('textarea[aria-label="Título da transmissão ao vivo"]');
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type('textarea[aria-label="Título da transmissão ao vivo"]', titulo);

    // Inserir descrição
    await page.waitForSelector('textarea[aria-label="Descrição da transmissão ao vivo"]', { timeout: 10000 });
    await page.focus('textarea[aria-label="Descrição da transmissão ao vivo"]');
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type('textarea[aria-label="Descrição da transmissão ao vivo"]', descricao);

    // Aguardar botão "Começar transmissão" habilitado e clicar
    // OBS: texto do botão pode variar, ajustar se necessário
    await page.waitForTimeout(2000);

    const startBtnSelector = 'div[aria-label="Começar transmissão"]';
    await page.waitForSelector(startBtnSelector, { visible: true, timeout: 10000 });
    const btn = await page.$(startBtnSelector);
    if (!btn) throw new Error("Botão 'Começar transmissão' não encontrado");

    await btn.click();

    // Opcional: aguardar confirmação de transmissão iniciada
    await page.waitForTimeout(5000);

    // Salvar cookies para manter sessão em execuções futuras (opcional)
    await saveCookies(page);

    await browser.close();
    console.log("Live configurada e iniciada com sucesso.");
  } catch (error) {
    await browser.close();
    throw error;
  }
}

module.exports = { launchFacebookLive };
