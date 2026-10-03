// About Me audit: proves the founder note now lives inside the footer, that its
// reveal/handwriting/signature animations actually run, and that it never
// introduces horizontal overflow or console errors.
// Run: node scripts/audit-about.mjs

const { chromium } = await import('playwright');

const VIEWPORTS = [
  [1440, 900, 'desktop'],
  [768, 1024, 'tablet-portrait'],
  [390, 844, 'mobile'],
];

const browser = await chromium.launch();
const results = [];
const check = (n, pass, d = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`);
};

for (const [w, h, label] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // About Me must live in the footer, not as its own landing section.
  const about = page.locator('footer .tm-about');
  check(`${label}: About Me is inside the footer`, (await about.count()) === 1, `count=${await about.count()}`);
  check(`${label}: About Me has a heading`, (await page.locator('#tm-about-heading').count()) === 1);

  // Scroll it into view so the IntersectionObserver reveal can run.
  await about.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  check(`${label}: reveal animation ran`, await page.evaluate(() => !!document.querySelector('footer .tm-about.tm-about-in')));

  // The reveal is a timeline: copy rises, the phrase writes, the signature
  // underlines, then the fragments fade in. Wait for the last beat.
  const settled = await page
    .waitForFunction(
      () => {
        const root = document.querySelector('footer .tm-about');
        const stroke = root?.querySelector('.tm-about-stroke');
        const fragment = [...(root?.querySelectorAll('span') ?? [])].find((s) =>
          s.classList.contains('tm-about-float'),
        );
        if (!root?.classList.contains('tm-about-in') || !stroke || !fragment) return false;
        return parseFloat(getComputedStyle(stroke).strokeDashoffset) < 0.02 && parseFloat(getComputedStyle(fragment).opacity) > 0.95;
      },
      { timeout: 8000, polling: 100 },
    )
    .then(() => true)
    .catch(() => false);

  const state = await page.evaluate(() => {
    const root = document.querySelector('footer .tm-about');
    const phrase = root?.querySelector('.tm-about-phrase');
    const stroke = root?.querySelector('.tm-about-stroke');
    const fragment = [...(root?.querySelectorAll('span') ?? [])].find((s) =>
      s.classList.contains('tm-about-float'),
    );
    return {
      clipRight: Number((getComputedStyle(phrase).clipPath.match(/inset\([^)]*\)/)?.[0] ?? 'inset(0px 0px 0px 0px)')
        .replace(/[^\d.-]/g, ' ')
        .trim()
        .split(/\s+/)[1]),
      strokeOffset: parseFloat(getComputedStyle(stroke).strokeDashoffset),
      fragmentOpacity: parseFloat(getComputedStyle(fragment).opacity),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  check(`${label}: reveal timeline completes`, settled === true);
  check(`${label}: handwriting phrase is written out`, Math.abs(state.clipRight) < 6, `clip-right=${state.clipRight}%`);
  check(`${label}: signature underline is drawn`, Math.abs(state.strokeOffset) < 0.02, `offset=${state.strokeOffset}`);
  check(`${label}: floating fragments faded in`, state.fragmentOpacity > 0.95, `opacity=${state.fragmentOpacity}`);
  check(`${label}: no horizontal overflow`, state.overflowX <= 0, `overflow=${state.overflowX}px`);
  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));

  await page.close();
}

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
await browser.close();