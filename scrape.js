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

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // ══════════════════════════
    // STANDINGS via WordPress proxy
    // ══════════════════════════
    await page.goto(
      'https://honkbalweek.nl/wp-admin/admin-ajax.php?action=hwh_standings',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    await new Promise(r => setTimeout(r, 5000));

    await page.waitForSelector('.standings-print', { timeout: 30000 });

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
    // UITSLAGEN — alleen vandaag via WordPress proxy
    // Historische data blijft in results.json staan
    // ══════════════════════════
    await page.goto(
      'https://honkbalweek.nl/wp-admin/admin-ajax.php?action=hwh_results',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    await new Promise(r => setTimeout(r, 5000));

    await page.waitForSelector('.schedule-item', { timeout: 30000 });

    const vandaag = new Date().toISOString().split('T')[0];

    const nieuweWedstrijden = await page.evaluate((datum) => {
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
    }, vandaag);

    console.log(`✅ Vandaag (${vandaag}): ${nieuweWedstrijden.length} wedstrijden gevonden`);

    // Lees bestaande results.json
    let bestaand = { updatedAt: new Date().toISOString(), results: [] };
    try {
      bestaand = JSON.parse(fs.readFileSync('results.json', 'utf8'));
    } catch(e) {
      console.log('Geen bestaande results.json gevonden, nieuw bestand aanmaken');
    }

    // Verwijder huidige dag uit bestaande data en voeg nieuwe toe
    const oudeWedstrijden = bestaand.results.filter(w => w.datum !== vandaag);
    const alleWedstrijden = [...oudeWedstrijden, ...nieuweWedstrijden];

    // Sorteer op datum
    alleWedstrijden.sort((a, b) => a.datum.localeCompare(b.datum));

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
