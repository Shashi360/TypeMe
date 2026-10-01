// Confirms doodles actually draw in as a scene settles, rather than sitting
// invisible or snapping to visibility. Run: node scripts/verify-doodles.mjs

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

const seek = async (prog) => {
  await page.evaluate((p) => {
    const track = document.querySelector('.tm-track');
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.round(top + (track.offsetHeight - window.innerHeight) * p));
  }, prog);
  await page.waitForTimeout(900);
};

const results = [];
const check = (n, pass, d = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`);
};

/* Chromium serialises the resolved dash offset as "calc(0.5666px)" when it
   comes from a custom property, and as "0.5666px" when it is a plain value.
   Pull the leading number out of either form.
   Inlined into page.evaluate because the helper lives in Node scope. */
const INLINE_DASH = `const dash = (el) => {
  const raw = getComputedStyle(el).strokeDashoffset;
  const m = String(raw).match(/-?[\\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
};`;

await seek(0.02);
const early = await page.evaluate(
  new Function(
    INLINE_DASH + `
  const s = document.querySelectorAll('.tm-scene')[0];
  const d = s.querySelector('.tm-doodle');
  return {
    d: getComputedStyle(s).getPropertyValue('--d').trim(),
    wrapOpacity: Number(getComputedStyle(s.querySelector('.tm-doodle-wrap')).opacity),
    dashoffset: dash(d).toFixed(3),
  };`,
  ),
);
check('early in scene: doodle partially drawn', Number(early.dashoffset) > 0.01 && Number(early.dashoffset) < 0.99, JSON.stringify(early));

await seek(0.1);
const settled = await page.evaluate(
  new Function(
    INLINE_DASH + `
  const s = document.querySelectorAll('.tm-scene')[0];
  const d = s.querySelector('.tm-doodle');
  return {
    d: getComputedStyle(s).getPropertyValue('--d').trim(),
    wrapOpacity: Number(getComputedStyle(s.querySelector('.tm-doodle-wrap')).opacity),
    dashoffset: dash(d).toFixed(3),
  };`,
  ),
);
check('settled: doodle fully drawn', Number(settled.dashoffset) < 0.05, JSON.stringify(settled));
check('settled: doodle wrapper visible', settled.wrapOpacity > 0.9, `opacity=${settled.wrapOpacity}`);

/* Every scene should reach full draw on its own accent. */
for (const [prog, idx] of [[0.08, 0], [0.3, 1], [0.5, 2], [0.7, 3], [0.87, 4], [0.99, 5]]) {
  await seek(prog);
  const r = await page.evaluate(
    new Function(
      'i',
      INLINE_DASH +
        `
  const s = document.querySelectorAll('.tm-scene')[i];
  const strokes = Array.from(s.querySelectorAll('.tm-doodle'));
  const dots = Array.from(s.querySelectorAll('.tm-doodle-fill'));
  const offs = strokes.map(dash);
  const wrap = s.querySelector('.tm-doodle-wrap');
  return {
    count: strokes.length,
    allDrawn: offs.length > 0 && offs.every((o) => o < 0.05),
    maxOff: offs.length ? Math.max(...offs) : null,
    wrapOp: wrap ? Number(getComputedStyle(wrap).opacity) : null,
    dotsVisible: dots.every((d) => Number(getComputedStyle(d).opacity) > 0.9),
    accent: wrap ? getComputedStyle(wrap).color : null,
  };`,
    ),
    idx,
  );
  check(
    `scene ${idx}: ${r.count} marks drawn`,
    r.allDrawn && r.wrapOp > 0.9,
    `maxOff=${r.maxOff} wrapOp=${r.wrapOp} accent=${r.accent} dots=${r.dotsVisible}`,
  );
}

/* Headline underline must draw, and stay a gradient (not a flat rule). */
const hl = await page.evaluate(
  new Function(
    INLINE_DASH +
      `
  const p = document.querySelector('.tm-hl-stroke');
  if (!p) return null;
  const cs = getComputedStyle(p);
  return { off: dash(p).toFixed(3), stroke: cs.stroke, width: cs.strokeWidth };`,
  ),
);
check('headline underline drawn', hl && Number(hl.off) < 0.05, JSON.stringify(hl));
check('headline underline is multicolor', !!hl && /gradient|url/.test(hl.stroke), hl?.stroke);

/* Closing block reveals on entry. */
const closing = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('.tm-closing > *'));
  return els.map((e) => Number(getComputedStyle(e).opacity));
});
check('closing content visible', closing.length > 0 && closing.every((o) => o > 0.9), JSON.stringify(closing));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
