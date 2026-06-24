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
    await page.goto(
      'https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/standings',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    await page.waitForSelector('.standings-print');

    const result = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.standings-print tbody tr')];

      const standings = [];

      for (const row of rows) {
        const codeEl = row.querySelector('.team-name');

        const teamCode = codeEl?.childNodes?.[0]?.textContent?.trim();
        const teamName = codeEl?.querySelector('small')?.textContent?.trim();

        const cells = [...row.querySelectorAll('td')].map(td =>
          td.innerText.trim()
        );

        // skip header row
        if (!teamCode || teamCode === '#') continue;

        standings.push({
          teamCode,
          team: teamName,
          wins: Number(cells[3]) || 0,
          losses: Number(cells[4]) || 0,
          ties: Number(cells[5]) || 0,
          pct: cells[6] || null,
          gb: cells[7] || null
        });
      }

      return {
        updatedAt: new Date().toISOString(),
        standings
      };
    });

    fs.writeFileSync(
      'standings.json',
      JSON.stringify(result, null, 2)
    );

    console.log("✅ Klaar:", result);

  } catch (err) {
    console.error("❌ ERROR:", err);

    fs.writeFileSync('debug.html', await page.content());

    process.exit(1);
  } finally {
    await browser.close();
  }
})();
