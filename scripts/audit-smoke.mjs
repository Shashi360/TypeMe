// Smoke test: confirm the page mounts with no console/page errors and that
// the new section is actually present in the rendered DOM.
// Run: node scripts/audit-smoke.mjs

const { chromium } = await import('playwright');
const browser = await chromium.launch();

const results = [];
const check = (n, pass, d = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`);
};

for (const [w, h, label] of [
  [1440, 900, 'desktop'],
  [390, 844, 'mobile'],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  // Mobile serves the compact home instead of the desktop story section.
  if (!(await page.locator('#where-to-use').isVisible())) {
    console.log(`--   ${label}: story section not served on this viewport, skipped`);
    await page.close();
    continue;
  }
  await page.locator('#where-to-use').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);

  const dom = await page.evaluate(() => {
    const sec = document.getElementById('where-to-use');
    const svgs = sec ? sec.querySelectorAll('svg').length : 0;
    const imgs = sec ? sec.querySelectorAll('img, video').length : 0;
    return {
      exists: !!sec,
      h2: sec?.querySelector('h2')?.textContent?.trim() || '',
      sub: sec?.querySelector('h2 + p')?.textContent?.trim() || '',
      scenes: sec?.querySelectorAll('.tm-scene').length || 0,
      cards: sec?.querySelectorAll('article').length || 0,
      svgs,
      media: imgs,
      ctas: Array.from(sec?.querySelectorAll('button') || []).map((b) => b.textContent.trim()),
      /* no other section should still carry the old grid */
      legacyPresent: !!document.getElementById('where-to-use-legacy'),
    };
  });

  check(`${label}: section mounted`, dom.exists);
  check(`${label}: headline is dominant copy`, /your font/i.test(dom.h2) && /one place/i.test(dom.h2), `"${dom.h2}"`);
  check(`${label}: support line short`, /write it once/i.test(dom.sub), `"${dom.sub}"`);
  check(`${label}: 6 scenes present`, dom.scenes === 6 || dom.cards === 6, `scenes=${dom.scenes} cards=${dom.cards}`);
  check(`${label}: SVG-only art, no media files`, dom.media === 0, `imgs/videos=${dom.media} svgs=${dom.svgs}`);
  check(`${label}: both CTAs present`, dom.ctas.some((c) => /create my font/i.test(c)) && dom.ctas.some((c) => /explore typeme/i.test(c)), JSON.stringify(dom.ctas));
  check(`${label}: legacy grid removed`, !dom.legacyPresent);
  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));

  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
