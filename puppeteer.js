const puppeteer = require('puppeteer');

module.exports = async function runPuppeteer(title, description) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // ⚠️ Acessa diretamente a página do Facebook Live Producer
  await page.goto('https://www.facebook.com/live/producer', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Aguarda os campos ficarem disponíveis
  try {
    await page.waitForSelector('[aria-label="Título"]', { timeout: 20000 });
    await page.type('[aria-label="Título"]', title);
    await page.waitForSelector('[aria-label="Descrição"]');
    await page.type('[aria-label="Descrição"]', description);

    // Aguarda botão de iniciar
    await page.waitForSelector('[aria-label="Iniciar transmissão ao vivo"]', { timeout: 20000 });
    await page.click('[aria-label="Iniciar transmissão ao vivo"]');

    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (err) {
    console.error('Erro durante execução do Puppeteer:', err.message);
    throw err;
  }

  await browser.close();
};
