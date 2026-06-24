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

  try {
    console.log("📡 Pagina openen...");

    await page.goto(
      'https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/standings',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    console.log("⏳ Wachten op table (met fallback)...");

    // BETERE WAIT: niet hard crashen als selector traag is
    await page.waitForFunction(() => {
      return document.querySelector('.standings-print') !== null;
    }, { timeout: 60000 });

    console.log("📊 Data ophalen...");

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

    console.log("💾 Schrijven naar file...");

    fs.writeFileSync(
      'standings.json',
      JSON.stringify(result, null, 2)
    );

    console.log("✅ Klaar!");

  } catch (err) {
    console.error("❌ ERROR:", err);

    // BELANGRIJK: dump debug info zodat je niet blind bent
    fs.writeFileSync(
      'debug.html',
      await page.content()
    );

    process.exit(1);
  } finally {
    await browser.close();
  }
})();
