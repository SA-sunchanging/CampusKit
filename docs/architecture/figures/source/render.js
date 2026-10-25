// Render each SVG given on the command line to a PNG 1600 px wide.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  for (const file of process.argv.slice(2)) {
    const svg = fs.readFileSync(file, 'utf8');
    const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const w = Number(m[1]);
    const h = Number(m[2]);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1600 / w });
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    const out = file.replace(/\.svg$/, '.png');
    await page.locator('svg').screenshot({ path: out });
    console.log('wrote', path.basename(out), w, 'x', h);
    await page.close();
  }
  await browser.close();
})();
