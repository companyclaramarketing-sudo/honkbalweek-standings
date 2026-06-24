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

  // Wacht even extra
  await new Promise(r => setTimeout(r, 5000));

  const result = await page.evaluate(() => {
    const table = document.querySelector('.standings-print');
    return {
      tableFound: !!table,
      tableHTML: table ? table.innerHTML.substring(0, 2000) : 'niet gevonden',
      allTables: document.querySelectorAll('table').length,
      bodyText: document.body.innerText.substring(0, 1000)
    };
  });

  fs.writeFileSync('standings.json', JSON.stringify(result, null, 2));
  console.log('Result:', result);

  await browser.close();
})();
