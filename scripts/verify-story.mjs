// Functional assertions for the scroll story. Replaces eyeballing screenshots,
// since it verifies the actual DOM/scroll state at each scene boundary.
// Run: node scripts/verify-story.mjs

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};

const seek = async (prog) => {
  await page.evaluate((p) => {
    const track = document.querySelector('.tm-track');
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.round(top + (track.offsetHeight - window.innerHeight) * p));
  }, prog);
  await page.waitForTimeout(700);
};

const EXPECT = ['journal', 'invitation', 'brand', 'social', 'art', 'signature'];

for (const [prog, expect] of [
  [0.08, 'journal'],
  [0.3, 'invitation'],
  [0.5, 'brand'],
  [0.7, 'social'],
  [0.87, 'art'],
  [0.99, 'signature'],
]) {
  await seek(prog);
  const state = await page.evaluate(() => {
    const scenes = Array.from(document.querySelectorAll('.tm-scene'));
    const ops = scenes.map((s) => Number(getComputedStyle(s).opacity));
    /* Read the narrative label that is actually faded in, not DOM order:
       all six labels share the narrative column and cross-fade. */
    const narrativeLabels = Array.from(
      document.querySelectorAll('.tm-stage #where-to-use span, .tm-stage span'),
    ).filter((s) => /^0\d\s—\s*(journal|invitation|brand|social|art|your signature)/i.test((s.textContent || '').trim()));
    let label = '';
    for (const el of narrativeLabels) {
      let p = el;
      let op = 1;
      while (p && !p.classList?.contains('tm-stage')) {
        op *= Number(getComputedStyle(p).opacity);
        p = p.parentElement;
      }
      if (op > 0.9) {
        label = el.textContent.trim();
        break;
      }
    }
    const phrase = document.querySelector('.tm-phrase-text');
    const pr = phrase ? phrase.getBoundingClientRect() : null;
    return {
      ops,
      top: ops.indexOf(Math.max(...ops)),
      maxOp: Math.max(...ops),
      label,
      phraseLeft: pr ? Math.round(pr.left) : null,
      phraseWidth: pr ? Math.round(pr.width) : null,
    };
  });
  const idx = EXPECT.indexOf(expect);
  check(`scene@${prog} => ${expect}`, state.top === idx, `visible=[${state.ops.map((o) => o.toFixed(2)).join(',')}]`);
  /* Scene 6 is labelled "Your Signature" in the UI, so compare on the short id. */
  /* Extract the ID part after the dash: "01 — Journal" -> journal */
  const labelId = state.label.toLowerCase().replace(/^0\d\s—\s*/, '').replace('your signature', 'signature').replace('your ', '').trim();
  check(`  narrative label is ${expect}`, labelId === expect, `got "${state.label}"`);
  check(
    `  phrase fully on screen`,
    state.phraseLeft !== null && state.phraseLeft >= 0 && state.phraseWidth > 100,
    `left=${state.phraseLeft} w=${state.phraseWidth}`,
  );
}

/* The phrase must actually MOVE between scenes (same element, travelling). */
const positions = [];
for (const prog of [0.08, 0.3, 0.5, 0.7, 0.87, 0.99]) {
  await seek(prog);
  positions.push(
    await page.evaluate(() => {
      const el = document.querySelector('.tm-phrase');
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), scale: getComputedStyle(el).transform };
    }),
  );
}
const xs = positions.map((p) => p.x);
const ys = positions.map((p) => p.y);
check('phrase travels horizontally', new Set(xs).size > 1, `xs=${xs.join(',')}`);
check('phrase travels vertically', new Set(ys).size > 1, `ys=${ys.join(',')}`);
check('phrase scales across scenes', new Set(positions.map((p) => p.scale)).size > 1);

/* Scene 6 swaps the copy to the signature line. */
await seek(0.99);
const sigText = await page.evaluate(() => document.querySelector('.tm-phrase-text')?.textContent || '');
check('signature scene copy', /your name/i.test(sigText), `"${sigText}"`);

/* The connector stroke must be a scene accent, never a heavy black thread. */
const connector = [];
for (const prog of [0.08, 0.3, 0.5, 0.7, 0.87, 0.99]) {
  await seek(prog);
  connector.push(
    await page.evaluate(() => {
      const el = document.querySelector('.tm-connector');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { stroke: cs.stroke, width: parseFloat(cs.strokeWidth), op: Number(cs.opacity) };
    }),
  );
}
const allAccent = connector.every((c) => c && c.stroke && c.stroke !== 'none');
check('connector has a visible accent stroke', allAccent, JSON.stringify(connector[0]));
const notBlack = connector.every((c) => c && !/^rgb\(0, 0, 0\)|^#000|black/i.test(c.stroke));
check('connector is never black', notBlack, connector.map((c) => c?.stroke).join(' '));
check('connector is a thin line', connector.every((c) => c.width <= 1), `width=${connector[0]?.width}`);

/* Reduced motion: sticky stage hidden, stacked cards visible, no clipping. */
const rm = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await rm.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await rm.locator('#where-to-use').scrollIntoViewIfNeeded();
await rm.waitForTimeout(500);
const rmState = await rm.evaluate(() => {
  /* The stage wrapper is what gets hidden; .tm-track is nested inside it. */
  const stage = document.querySelector('.tm-stage');
  const stack = document.querySelector('.tm-stack');
  const cards = Array.from(document.querySelectorAll('#where-to-use article'));
  return {
    stageHidden: getComputedStyle(stage).display === 'none',
    stageVisible: stage.getBoundingClientRect().height > 0,
    stackVisible: stack.getBoundingClientRect().height > 0,
    visibleCards: cards.filter((c) => c.getBoundingClientRect().height > 0).length,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
check('reduced: sticky stage hidden', rmState.stageHidden && !rmState.stageVisible, `stageVisible=${rmState.stageVisible}`);
check('reduced: stacked cards visible', rmState.stackVisible && rmState.visibleCards >= 6, `stack=${rmState.stackVisible} cards=${rmState.visibleCards}`);
check('reduced: no horizontal overflow', rmState.docOverflow <= 1, `overflow=${rmState.docOverflow}`);

/* Reduced motion must also be clean on a phone width. */
const rmm = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await rmm.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
// Mobile serves the compact home (story cards hidden) — nothing to verify.
if (!(await rmm.locator('#where-to-use').isVisible().catch(() => false))) {
  console.log('--   reduced 390px: story section not served on this viewport, skipped');
  await rmm.close();
} else {
await rmm.locator('#where-to-use').scrollIntoViewIfNeeded();
await rmm.waitForTimeout(400);
const rmMobileState = await rmm.evaluate(() => ({
  cards: Array.from(document.querySelectorAll('#where-to-use article')).filter((c) => c.getBoundingClientRect().height > 0).length,
  docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
check('reduced 390px: cards visible', rmMobileState.cards >= 6, `cards=${rmMobileState.cards}`);
check('reduced 390px: no overflow', rmMobileState.docOverflow <= 1, `overflow=${rmMobileState.docOverflow}`);
await rmm.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
