const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log("🚀 Test gestart");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.goto('https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/standings', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 10000));

  const result = await page.evaluate(() => ({
    title: document.title,
    url: window.location.href,
    bodyLength: document.body.innerHTML.length,
    hasStandings: !!document.querySelector('.standings-print'),
    hasContainer: !!document.querySelector('.standings-page'),
    bodyText: document.body.innerText.substring(0, 500)
  }));

  console.log("📄 Resultaat:", JSON.stringify(result, null, 2));

  fs.writeFileSync('standings.json', JSON.stringify({ updatedAt: new Date().toISOString(), standings: [] }, null, 2));
  fs.writeFileSync('results.json', JSON.stringify({ updatedAt: new Date().toISOString(), results: [] }, null, 2));

  await browser.close();
})();
