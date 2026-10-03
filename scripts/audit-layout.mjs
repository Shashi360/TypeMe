// Dev-only layout audit for the "Your font doesn't belong in one place." section.
// Run: node scripts/audit-layout.mjs
// Checks every required breakpoint for horizontal overflow and element clipping.

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const HEIGHT = 900;

const { chromium } = await import('playwright').catch(() => ({ chromium: null }));

if (!chromium) {
  console.error('playwright not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const browser = await chromium.launch();
let failures = 0;

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
  const reduced = process.argv.includes('--reduced');
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Mobile serves the compact home instead of the desktop story section.
  if (!(await page.locator('#where-to-use').isVisible())) {
    console.log(`--   ${width}px: story section not served on this viewport, skipped`);
    await page.close();
    continue;
  }
  const section = page.locator('#where-to-use');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);

  const report = await page.evaluate(() => {
    const sec = document.getElementById('where-to-use');
    if (!sec) return { missing: true };

    const vw = document.documentElement.clientWidth;
    const docOverflow = document.documentElement.scrollWidth - vw;
    const secOverflow = sec.scrollWidth - sec.clientWidth;

    /* Only judge what is actually rendered. The desktop sticky stage and the
       mobile card stack are mutually exclusive, so display:none subtrees are
       intentionally skipped. */
    const isRendered = (el) => {
      let n = el;
      while (n && n !== document.body) {
        if (getComputedStyle(n).display === 'none') return false;
        n = n.parentElement;
      }
      return true;
    };

    const spills = [];
    sec.querySelectorAll('*').forEach((el) => {
      if (!isRendered(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (getComputedStyle(el).position === 'fixed') return;
      if (r.right > vw + 1 || r.left < -1) {
        spills.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 70),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    });

    // Headline / CTA must not be visually cropped.
    const clipped = [];
    const cta = (re) =>
      Array.from(sec.querySelectorAll('button')).find((b) => re.test(b.textContent || '') && isRendered(b));
    const check = [
      ['h2', sec.querySelector('h2')],
      ['h3-closing', Array.from(sec.querySelectorAll('h3')).find(isRendered)],
      ['cta-create', cta(/create my font/i)],
      ['cta-explore', cta(/explore typeme/i)],
    ];
    for (const [name, el] of check) {
      if (!el || !isRendered(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > vw + 1) {
        clipped.push({ name, left: Math.round(r.left), right: Math.round(r.right) });
      }
    }

    /* Every scene label must be visible in whichever layout is active. */
    const NAMES = /^(journal|invitation|brand|social|art|your signature)$/i;
    const labels = Array.from(sec.querySelectorAll('span')).filter(
      (s) => NAMES.test((s.textContent || '').trim()) && isRendered(s),
    );
    const labelHidden = labels.filter((l) => {
      const r = l.getBoundingClientRect();
      return r.width === 0 || r.height === 0;
    }).length;

    /* The handwriting phrase must not be cropped by any ancestor, and must
       actually be on screen in the active layout. */
    const phraseCandidates = Array.from(sec.querySelectorAll('.tm-phrase-text, .font-handwriting')).filter(isRendered);
    const phrase = phraseCandidates.find((p) => /make it yours|your name/i.test(p.textContent || ''));
    let phraseClipped = false;
    let phraseWidth = 0;
    if (phrase) {
      const r = phrase.getBoundingClientRect();
      phraseWidth = Math.round(r.width);
      if (r.width === 0 || r.left < -1 || r.right > vw + 1) phraseClipped = true;
      let p = phrase.parentElement;
      while (p && p !== document.body) {
        const cs = getComputedStyle(p);
        if ((cs.overflow === 'hidden' || cs.overflow === 'clip') && r.right > p.getBoundingClientRect().right + 1) {
          phraseClipped = true;
          break;
        }
        p = p.parentElement;
      }
    }
    if (!phrase) phraseClipped = true;

    /* Scene cards on mobile must not overlap their own text. */
    const overlaps = [];
    sec.querySelectorAll('article').forEach((card) => {
      if (!isRendered(card)) return;
      const cr = card.getBoundingClientRect();
      const ps = card.querySelector('p');
      if (!ps) return;
      const pr = ps.getBoundingClientRect();
      if (pr.left < cr.left - 1 || pr.right > cr.right + 1) {
        overlaps.push({ card: Math.round(cr.left) + '-' + Math.round(cr.right), text: Math.round(pr.left) + '-' + Math.round(pr.right) });
      }
    });

    return {
      docOverflow,
      secOverflow,
      spills: spills.slice(0, 6),
      clipped,
      labelCount: labels.length,
      labelHidden,
      phraseClipped,
      phraseWidth,
      overlaps,
      sectionHeight: Math.round(sec.getBoundingClientRect().height),
    };
  });

  const bad =
    report.missing ||
    report.docOverflow > 1 ||
    report.spills.length > 0 ||
    report.clipped.length > 0 ||
    report.phraseClipped ||
    report.overlaps.length > 0;

  if (bad) failures++;
  console.log(
    `${bad ? 'FAIL' : 'ok  '} ${String(width).padStart(4)}px${reduced ? ' (reduced)' : ''}  ` +
      `docOverflow=${report.docOverflow} secOverflow=${report.secOverflow} ` +
      `labels=${report.labelCount} hidden=${report.labelHidden} ` +
      `phraseW=${report.phraseWidth} h=${report.sectionHeight}`,
  );
  if (report.spills.length) console.log('     spills:', JSON.stringify(report.spills));
  if (report.clipped.length) console.log('     clipped:', JSON.stringify(report.clipped));
  if (report.overlaps.length) console.log('     overlaps:', JSON.stringify(report.overlaps));
  if (report.phraseClipped) console.log('     phrase clipped or missing');
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} breakpoint(s) failed` : '\nAll breakpoints clean');
process.exit(failures ? 1 : 0);
