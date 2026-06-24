const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log("🚀 Scraper gestart");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();

  console.log("📡 Pagina laden...");

  await page.goto(
    'https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/standings',
    { waitUntil: 'networkidle2', timeout: 60000 }
  );

  console.log("⏳ Wachten op tabel...");

  await page.waitForSelector('.standings-print', { timeout: 60000 });

  await page.waitForTimeout(3000);

  console.log("📊 Data extraheren...");

  const result = await page.evaluate(() => {
    const table = document.querySelector('.standings-print');
    const rows = table?.querySelectorAll('tbody tr') || [];

    const standings = [...rows].map(row => {
      const cols = row.querySelectorAll('td');

      if (cols.length < 6) return null;

      return {
        teamCode: cols[0]?.innerText.trim(),
        team: cols[1]?.innerText.trim(),
        wins: Number(cols[2]?.innerText.trim()) || 0,
        losses: Number(cols[3]?.innerText.trim()) || 0,
        ties: Number(cols[4]?.innerText.trim()) || 0,
        pct: cols[5]?.innerText.trim() || null,
        gb: cols[6]?.innerText.trim() || null
      };
    }).filter(Boolean);

    return {
      updatedAt: new Date().toISOString(),
      standings
    };
  });

  console.log("💾 Writing file...");

  fs.writeFileSync(
    'standings.json',
    JSON.stringify(result, null, 2)
  );

  console.log("✅ Klaar!");

  await browser.close();
})();
