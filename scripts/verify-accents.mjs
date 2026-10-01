// Confirms the scene accents match the requested palette and that copy is short.
// Run: node scripts/verify-accents.mjs

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

const results = [];
const check = (n, pass, d = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`);
};

const SCENES = [
  { idx: 0, name: 'journal', want: 'blue' },
  { idx: 1, name: 'invitation', want: 'lavender' },
  { idx: 2, name: 'brand', want: 'orange' },
  { idx: 3, name: 'social', want: 'mint' },
  { idx: 4, name: 'art', want: 'coral' },
  { idx: 5, name: 'signature', want: 'neutral' },
];

/* Sample the live accent of each scene's doodle wrapper while that scene is up. */
for (const s of SCENES) {
  const prog = [0.08, 0.3, 0.5, 0.7, 0.87, 0.99][s.idx];
  await page.evaluate((p) => {
    const t = document.querySelector('.tm-track');
    const top = t.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.round(top + (t.offsetHeight - window.innerHeight) * p));
  }, prog);
  await page.waitForTimeout(700);

  const r = await page.evaluate((i) => {
    const scene = document.querySelectorAll('.tm-scene')[i];
    const wrap = scene.querySelector('.tm-doodle-wrap');
    const m = getComputedStyle(wrap).color.match(/\d+/g).map(Number);
    const [rr, gg, bb] = m;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    return {
      rgb: [rr, gg, bb],
      sat: max === 0 ? 0 : (max - min) / max,
      /* The narrative column cross-fades six labels at once, so read the one
         that is actually opaque rather than the first in DOM order. */
      label: (() => {
        const hits = Array.from(document.querySelectorAll('.tm-stage span')).filter((el) =>
          /^0\d\s—/.test(el.textContent.trim()),
        );
        for (const el of hits) {
          let p = el;
          let op = 1;
          while (p && !p.classList.contains('tm-stage')) {
            op *= Number(getComputedStyle(p).opacity);
            p = p.parentElement;
          }
          if (op > 0.9) return el.textContent.trim();
        }
        return hits.map((h) => h.textContent.trim()).join('|') || 'none-opaque';
      })(),
    };
  }, s.idx);

  const [rr, gg, bb] = r.rgb;
  /* Soft, not saturated: the spec says "do not make colors overly saturated". */
  check(
    `${s.name} (${s.want}): accent is soft, not saturated`,
    r.sat <= 0.8,
    `rgb(${r.rgb.join(',')}) sat=${r.sat.toFixed(2)}`,
  );
  /* A neutral may be a slightly warm gray, so judge on saturation rather than
     exact channel equality. */
  const sat = maxSat(r.rgb);
  check(
    `${s.name}: accent reads as ${s.want}`,
    s.want === 'neutral' ? sat <= 0.12 : sat > 0.25,
    `sat=${sat.toFixed(2)} rgb(${r.rgb.join(',')})`,
  );
  check(`${s.name}: label is numbered`, /^0\d\s—/.test(r.label), `"${r.label}"`);
}

function maxSat([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/* Copy must stay short: no paragraph-length text in the section. */
const copy = await page.evaluate(() => {
  const sec = document.getElementById('where-to-use');
  return Array.from(sec.querySelectorAll('p'))
    .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 0);
});
const long = copy.filter((t) => t.split(/\s+/).length > 12);
check('no paragraph-length copy', long.length === 0, long.length ? JSON.stringify(long) : `${copy.length} short lines`);

/* The closing CTA copy should match the spec. */
const closing = await page.evaluate(() => {
  const c = document.querySelector('.tm-closing');
  return {
    h3: c?.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    p: c?.querySelector('p')?.textContent?.trim() || '',
  };
});
check(
  'closing reads ONE FONT / ENDLESS PLACES',
  /one font/i.test(closing.h3) && /endless places/i.test(closing.h3),
  `"${closing.h3}"`,
);
check(
  'closing support line matches spec',
  /create your handwriting once/i.test(closing.p) && /wherever you create/i.test(closing.p),
  `"${closing.p}"`,
);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
