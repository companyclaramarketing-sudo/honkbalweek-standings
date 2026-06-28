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
    // UITSLAGEN — alle dagen
    // ══════════════════════════
    await page.goto(
      'https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/schedule-and-results',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );
    await page.waitForSelector('.date-picker', { timeout: 15000 });

    // Ga naar 26 juni — begin van het toernooi
    // Eerst teruggaan naar het begin via de vorige knop
    // De pagina opent standaard op vandaag — we navigeren naar 26 juni
    const toernooidagen = [
      '2026-06-26',
      '2026-06-27',
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ];

    const alleWedstrijden = [];

    for (const datum of toernooidagen) {
      console.log(`📅 Ophalen: ${datum}`);

      // Stel de datum in via de input
      await page.evaluate((d) => {
        const input = document.querySelector('input[name="date"]');
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, d);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, datum);

      // Wacht op nieuwe wedstrijden
      await new Promise(r => setTimeout(r, 2500));

      const wedstrijden = await page.evaluate((datum) => {
        const items = document.querySelectorAll('.schedule-item');
        return Array.from(items).map(item => {
          const scoreEl = item.querySelector('.baseball-score-bug > div:nth-child(2) > p:first-child');
          const scoreText = scoreEl?.innerText?.trim() || '';
          const scoreParts = scoreText.split(':').map(s => s.trim());
          const visitorScore = (scoreParts[0] && scoreParts[0] !== 'VISITOR') ? scoreParts[0] : null;
          const homeScore = (scoreParts[1] && scoreParts[1] !== 'HOME') ? scoreParts[1] : null;

          const timeEl = item.querySelector('.box-score-link:first-child div:last-child p:last-child');
          const time = timeEl?.innerText?.trim() || '';

          return {
            datum,
            tijd: time,
            visitor: {
              code: item.querySelector('.team-info:first-child .code strong')?.innerText?.trim() || '',
              name: item.querySelector('.team-info:first-child p:not(.dugout):not(.code):not(.group)')?.innerText?.trim() || '',
              flag: item.querySelector('.team-info:first-child img')?.src || '',
              score: visitorScore
            },
            home: {
              code: item.querySelector('.team-info:last-child .code strong')?.innerText?.trim() || '',
              name: item.querySelector('.team-info:last-child p:not(.dugout):not(.code):not(.group)')?.innerText?.trim() || '',
              flag: item.querySelector('.team-info:last-child img')?.src || '',
              score: homeScore
            },
            status: item.querySelector('.game-label p strong')?.innerText?.trim() || ''
          };
        }).filter(w => w.visitor.code);
      }, datum);

      console.log(`  → ${wedstrijden.length} wedstrijden gevonden`);
      alleWedstrijden.push(...wedstrijden);
    }

    fs.writeFileSync('results.json', JSON.stringify({
      updatedAt: new Date().toISOString(),
      results: alleWedstrijden
    }, null, 2));
    console.log("✅ Uitslagen klaar:", alleWedstrijden.length, "wedstrijden totaal");

  } catch (err) {
    console.error("❌ ERROR:", err);
    fs.writeFileSync('debug.html', await page.content());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
