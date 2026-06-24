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

  await page.waitForSelector('.standings-print', { timeout: 15000 });

  const standings = await page.evaluate(() => {
    const rows = document.querySelectorAll('.standings-print tbody tr:not(:first-child)');
    return Array.from(rows).map((row, i) => {
      const cells = row.querySelectorAll('td');
      const vlag = row.querySelector('img')?.src || '';
      const code = row.querySelector('.team-name')?.childNodes[0]?.textContent?.trim() || '';
      const naam = row.querySelector('.team-name small')?.innerText?.trim() || '';
      return {
        positie: i + 1,
        code,
        naam,
        vlag,
        w:   cells[3]?.innerText?.trim(),
        l:   cells[4]?.innerText?.trim(),
        t:   cells[5]?.innerText?.trim(),
        pct: cells[6]?.innerText?.trim(),
        gb:  cells[7]?.innerText?.trim(),
      };
    }).filter(r => r.naam);
  });

  fs.writeFileSync('standings.json', JSON.stringify(standings, null, 2));
  console.log('Done:', standings);

  await browser.close();
})();
