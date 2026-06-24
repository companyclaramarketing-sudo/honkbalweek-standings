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

    console.log("⏳ Wachten op tabel...");

    await page.waitForSelector('.standings-print', { timeout: 60000 });

    console.log("📊 Data extraheren...");

    const result = await page.evaluate(() => {
      const table = document.querySelector('.standings-print');

      const rows = [...table.querySelectorAll('tbody tr')]
        .filter(row => row.innerText && row.innerText.trim().length > 0);

      const standings = [];

      for (const row of rows) {
        const cells = [...row.querySelectorAll('td, th')]
          .map(c => (c.innerText || '').replace(/\s+/g, ' ').trim());

        // skip lege of header-achtige rijen
        if (cells.length < 6) continue;

        const teamCode = cells[0];
        const team = cells[1];

        // skip header/invalid rows
        if (!team || team.toLowerCase().includes('team') || team.toLowerCase().includes('#')) {
          continue;
        }

        standings.push({
          teamCode: teamCode || null,
          team: team || null,
          wins: Number(cells[2]) || 0,
          losses: Number(cells[3]) || 0,
          ties: Number(cells[4]) || 0,
          pct: cells[5] || null,
          gb: cells[6] || null
        });
      }

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

  } catch (err) {
    console.error("❌ ERROR:", err);

    fs.writeFileSync(
      'debug.html',
      await page.content()
    );

    process.exit(1);
  } finally {
    await browser.close();
  }
})();
