// Confirms the doodle + headline draw is scroll-driven, not a one-shot
// animation that fires on mount and leaves the marks blank on later scenes.
// Run: node scripts/verify-scroll-driven.mjs

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

const results = [];
const check = (n, pass, d = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`);
};

const seek = async (prog) => {
  await page.evaluate((p) => {
    const t = document.querySelector('.tm-track');
    const top = t.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.round(top + (t.offsetHeight - window.innerHeight) * p));
  }, prog);
  await page.waitForTimeout(450);
};

const dash = new Function(
  `return (el) => {
    const raw = getComputedStyle(el).strokeDashoffset;
    const m = String(raw).match(/-?[\\d.]+/);
    return m ? parseFloat(m[0]) : NaN;
  }`,
)();

/* --- marks must be undrawn when their scene is far away ------------------ */
await seek(0.5); // brand active
const farOff = await page.evaluate(() => {
  const scenes = document.querySelectorAll('.tm-scene');
  return [3, 4, 5].map((i) => {
    const d = scenes[i].querySelector('.tm-doodle');
    const raw = getComputedStyle(d).strokeDashoffset;
    const m = String(raw).match(/-?[\d.]+/);
    return { i, off: m ? parseFloat(m[0]) : NaN, opacity: Number(getComputedStyle(scenes[i]).opacity) };
  });
});
check(
  'unreached scenes keep marks undrawn',
  farOff.every((s) => s.off > 0.5),
  JSON.stringify(farOff.map((s) => s.off.toFixed(2))),
);

/* --- scrolling back should RE-draw, proving the link is to scroll --------- */
await seek(0.08); // journal active
await seek(0.95); // jump away
await seek(0.1); // come back
const redraw = await page.evaluate(() => {
  const d = document.querySelectorAll('.tm-scene')[0].querySelector('.tm-doodle');
  const raw = getComputedStyle(d).strokeDashoffset;
  const m = String(raw).match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
});
check('marks re-draw on return scroll', redraw < 0.1, `off=${redraw.toFixed(3)}`);

/* --- each scene's marks must be independent ------------------------------ */
const perScene = [];
for (const [prog, idx] of [[0.08, 0], [0.3, 1], [0.5, 2], [0.7, 3], [0.87, 4], [0.99, 5]]) {
  await seek(prog);
  const r = await page.evaluate((i) => {
    const scenes = document.querySelectorAll('.tm-scene');
    const mine = scenes[i].querySelector('.tm-doodle');
    const raw = getComputedStyle(mine).strokeDashoffset;
    const m = String(raw).match(/-?[\d.]+/);
    return {
      mine: m ? parseFloat(m[0]) : NaN,
      d: Number(getComputedStyle(scenes[i]).getPropertyValue('--d')),
    };
  }, idx);
  perScene.push({ idx, ...r });
}
check(
  'every scene draws its own marks',
  perScene.every((r) => r.mine < 0.1 && r.d > 0.9),
  JSON.stringify(perScene.map((r) => `${r.idx}:d=${r.d.toFixed(2)}/off=${r.mine.toFixed(2)}`)),
);

/* --- headline underline should draw on entry and stay drawn ------------ */
await page.evaluate(() => {
  const sec = document.getElementById('where-to-use');
  window.scrollTo(0, sec.getBoundingClientRect().top + window.scrollY - 200);
});
// The underline is a 1.4s draw with a 0.25s delay: wait for it to settle rather
// than racing a fixed sleep against the animation timeline.
const hlDrawn = await page
  .waitForFunction(
    () => {
      const p = document.querySelector('.tm-hl-stroke');
      if (!p) return false;
      const m = String(getComputedStyle(p).strokeDashoffset).match(/-?[\d.]+/);
      return m ? parseFloat(m[0]) < 0.05 : false;
    },
    { timeout: 8000, polling: 100 },
  )
  .then(() => true)
  .catch(() => false);
const hl = await page.evaluate(() => {
  const p = document.querySelector('.tm-hl-stroke');
  const raw = getComputedStyle(p).strokeDashoffset;
  const m = String(raw).match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
});
check('headline underline stays drawn after entry', hlDrawn && hl < 0.05, `off=${hl}`);

/* --- the reveal clip is released, so the phrase is readable ------------- */
await seek(0.99);
const clip = await page.evaluate(() => {
  const t = document.querySelector('.tm-phrase-text');
  return getComputedStyle(t).clipPath;
});
check('phrase not clipped by reveal at end', /inset\(0(px)?\s*(0%|0px)/.test(clip) || clip === 'none', clip);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
