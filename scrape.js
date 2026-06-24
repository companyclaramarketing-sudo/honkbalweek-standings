const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  await page.goto(
    'https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/standings',
    { waitUntil: 'networkidle2', timeout: 30000 }
  );

  await page.waitForSelector('table', { timeout: 15000 });

  const standings = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    return Array.from(rows).map(row => {
      const cells = row.querySelectorAll('td');
      return {
        positie: cells[0]?.innerText?.trim(),
        team:    cells[1]?.innerText?.trim(),
        w:       cells[2]?.innerText?.trim(),
        l:       cells[3]?.innerText?.trim(),
        t:       cells[4]?.innerText?.trim(),
        pct:     cells[5]?.innerText?.trim(),
      };
    }).filter(r => r.team);
  });

  fs.writeFileSync('standings.json', JSON.stringify(standings, null, 2));
  console.log('Done:', standings);

  await browser.close();
})();
