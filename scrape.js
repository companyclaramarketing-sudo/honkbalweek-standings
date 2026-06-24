const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.goto(
    'https://stats.knbsbstats.nl/en/events/2026-honkbalweek-haarlem/standings',
    { waitUntil: 'networkidle2', timeout: 60000 }
  );

  // Wacht expliciet tot de standings tabel er is
  await page.waitForSelector('.standings-print', { timeout: 30000 });

  const result = await page.evaluate(() => {
    const table = document.querySelector('.standings-print');

    const rows = table?.querySelectorAll('tbody tr') || [];

    const standings = [...rows].map(row => {
      const cols = row.querySelectorAll('td');

      // soms lege rows of separators
      if (!cols || cols.length < 6) return null;

      return {
        teamCode: cols[0]?.innerText.trim() || null,
        team: cols[1]?.innerText.trim() || null,
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

  fs.writeFileSync('standings.json', JSON.stringify(result, null, 2));

  console.log('Scrape succesvol:', result);

  await browser.close();
})();
