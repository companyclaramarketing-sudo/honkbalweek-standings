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
    // UITSLAGEN
    // ══════════════════════════
    await page.goto(
      'https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/schedule-and-results',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );
    await page.waitForSelector('.schedule-item', { timeout: 15000 });

    const resultsResult = await page.evaluate(() => {
      const items = document.querySelectorAll('.schedule-item');
      return Array.from(items).map(item => {

        // Datum en tijd
        const infoEl = item.querySelector('.box-score-link:first-child');
        const round = infoEl?.querySelector('div:first-child p:first-child')?.innerText?.trim() || '';
        const datetime = infoEl?.querySelector('div:last-child p:last-child')?.innerText?.trim() || '';

        // Teams
        const teams = item.querySelectorAll('.team-info');
        const getTeam = (el) => ({
          code: el?.querySelector('.code strong')?.innerText?.trim() || '',
          name: el?.querySelector('p:not(.dugout):not(.code):not(.group)')?.innerText?.trim() || '',
          flag: el?.querySelector('img')?.src || ''
        });

        const visitor = getTeam(teams[0]);
        const home = getTeam(teams[1]);

        // Score
        const scoreEl = item.querySelector('.baseball-score-bug > div > p:first-child');
        const score = scoreEl?.innerText?.trim() || '';
        const scoreParts = score.split(':').map(s => s.trim());
        const visitorScore = scoreParts[0] || null;
        const homeScore = scoreParts[1] || null;

        // Status
        const statusEl = item.querySelector('.game-label p strong');
        const status = statusEl?.innerText?.trim() || '';

        return {
          round,
          datetime,
          visitor,
          home,
          visitorScore,
          homeScore,
          status
        };
      }).filter(r => r.visitor.code);
    });

    fs.writeFileSync('results.json', JSON.stringify({
      updatedAt: new Date().toISOString(),
      results: resultsResult
    }, null, 2));
    console.log("✅ Uitslagen klaar:", resultsResult.length, "wedstrijden");

  } catch (err) {
    console.error("❌ ERROR:", err);
    fs.writeFileSync('debug.html', await page.content());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
