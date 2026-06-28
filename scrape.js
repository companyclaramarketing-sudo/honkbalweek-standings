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
    // ══════════════════════════
    // STANDINGS
    // ══════════════════════════
    await page.goto(
      'https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/standings',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );
    await page.waitForSelector('.standings-print');

    const standingsResult = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.standings-print tbody tr')];
      const standings = [];
      for (const row of rows) {
        const codeEl = row.querySelector('.team-name');
        const teamCode = codeEl?.childNodes?.[0]?.textContent?.trim();
        const teamName = codeEl?.querySelector('small')?.textContent?.trim();
        const cells = [...row.querySelectorAll('td')].map(td => td.innerText.trim());
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
      return { updatedAt: new Date().toISOString(), standings };
    });

    fs.writeFileSync('standings.json', JSON.stringify(standingsResult, null, 2));
    console.log("✅ Standings klaar:", standingsResult.standings.length, "teams");

    // ══════════════════════════
    // UITSLAGEN via WBSC API
    // ══════════════════════════
    const resultsData = await page.evaluate(async () => {
      const res = await fetch('https://game.wbsc.org/gamedata/livescores.json');
      const data = await res.json();
      return data.filter(game => game.tournamentid === '3487');
    });

    fs.writeFileSync('results.json', JSON.stringify({
      updatedAt: new Date().toISOString(),
      results: resultsData
    }, null, 2));
    console.log("✅ Uitslagen klaar:", resultsData.length, "wedstrijden");

  } catch (err) {
    console.error("❌ ERROR:", err);
    fs.writeFileSync('debug.html', await page.content());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
