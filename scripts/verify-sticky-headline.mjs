// Verifies the refinement's core promise: the headline stays on screen for the
// entire story, in both the desktop sticky column and the mobile sticky header.
// Run: node scripts/verify-sticky-headline.mjs

const { chromium } = await import('playwright');
const browser = await chromium.launch();

const results = [];
const check = (n, pass, d = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`);
};

const SAMPLE = [0.02, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 0.99];

/* ---------------------------------------------------------------- desktop */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  for (const prog of SAMPLE) {
    await page.evaluate((p) => {
      const t = document.querySelector('.tm-track');
      const top = t.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.round(top + (t.offsetHeight - window.innerHeight) * p));
    }, prog);
    await page.waitForTimeout(600);

    const r = await page.evaluate(() => {
      const sec = document.getElementById('where-to-use');
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      /* the headline inside the sticky left column */
      const heads = Array.from(sec.querySelectorAll('.tm-headline')).filter((el) => {
        let n = el;
        while (n && n.id !== 'where-to-use') {
          if (getComputedStyle(n).display === 'none') return false;
          n = n.parentElement;
        }
        return el.getBoundingClientRect().height > 0;
      });
      const h = heads[0];
      if (!h) return { missing: true, count: heads.length };
      const hr = h.getBoundingClientRect();
      const h2 = h.querySelector('h2');
      const sub = h.querySelector('p');
      return {
        count: heads.length,
        text: h2?.textContent?.replace(/\s+/g, ' ').trim() || '',
        sub: sub?.textContent?.trim() || '',
        top: Math.round(hr.top),
        bottom: Math.round(hr.bottom),
        left: Math.round(hr.left),
        visible: hr.top < vh && hr.bottom > 0 && hr.left < vw && hr.right > 0,
        fullyInView: hr.top >= -1 && hr.bottom <= vh + 1,
      };
    });

    check(
      `desktop ${(prog * 100).toFixed(0).padStart(3)}%: headline visible`,
      !r.missing && r.visible,
      r.missing ? 'headline not found' : `top=${r.top} bottom=${r.bottom}`,
    );
    check(
      `desktop ${(prog * 100).toFixed(0).padStart(3).padStart(2)}%: exact copy intact`,
      /your font/i.test(r.text) && /one place/i.test(r.text) && /write it once\. bring it everywhere\./i.test(r.sub),
      `"${r.text}" / "${r.sub}"`,
    );
    if (prog === 0.02) {
      check('desktop: only one headline rendered', r.count === 1, `count=${r.count}`);
    }
  }

  /* the headline must not scroll away: its viewport position should be stable */
  const tops = [];
  for (const prog of SAMPLE) {
    await page.evaluate((p) => {
      const t = document.querySelector('.tm-track');
      const top = t.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.round(top + (t.offsetHeight - window.innerHeight) * p));
    }, prog);
    await page.waitForTimeout(400);
    tops.push(
      await page.evaluate(() => Math.round(document.querySelector('.tm-headline h2').getBoundingClientRect().top)),
    );
  }
  const spread = Math.max(...tops) - Math.min(...tops);
  check('desktop: headline does not move vertically', spread <= 4, `spread=${spread}px tops=${tops.join(',')}`);

  await page.close();
}

/* ----------------------------------------------------------------- mobile */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  /* Sample while the story cards are still on screen. Past that the section is
     scrolling away, so a pinned header is not expected to still be visible. */
  const found = [];
  for (let i = 0; i <= 8; i++) {
    await page.evaluate((f) => {
      const sec = document.getElementById('where-to-use');
      const top = sec.getBoundingClientRect().top + window.scrollY;
      const h = sec.offsetHeight;
      window.scrollTo(0, Math.round(top + h * f));
    }, i / 10);
    await page.waitForTimeout(400);
    found.push(
      await page.evaluate(() => {
        const head = document.querySelector('.tm-stack-head');
        if (!head) return null;
        const r = head.getBoundingClientRect();
        const cs = getComputedStyle(head);
        return {
          pos: cs.position,
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          inView: r.bottom > 0 && r.top < window.innerHeight,
        };
      }),
    );
  }

  check('mobile: sticky header is sticky', found.every((f) => f && f.pos === 'sticky'), found[0]?.pos);
  const inViewCount = found.filter((f) => f && f.inView).length;
  check('mobile: headline visible through story', inViewCount === found.length, `${inViewCount}/${found.length} samples in view`);

  const mobileCopy = await page.evaluate(() => {
    const h = document.querySelector('.tm-stack-head');
    return {
      h2: h?.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      sub: h?.querySelector('p')?.textContent?.trim() || '',
    };
  });
  check(
    'mobile: exact copy intact',
    /your font/i.test(mobileCopy.h2) && /one place/i.test(mobileCopy.h2) && /write it once/i.test(mobileCopy.sub),
    `"${mobileCopy.h2}" / "${mobileCopy.sub}"`,
  );

  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('mobile: no horizontal overflow', noOverflow <= 1, `overflow=${noOverflow}`);

  await page.close();
}

/* ------------------------------------------------------------- reduced */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll('#where-to-use .tm-headline'));
    const rendered = heads.filter((h) => h.getBoundingClientRect().height > 0);
    const sticky = document.querySelector('.tm-stack-head');
    return {
      rendered: rendered.length,
      text: rendered[0]?.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      pos: sticky ? getComputedStyle(sticky).position : null,
    };
  });
  check('reduced: headline still present', r.rendered === 1, `rendered=${r.rendered}`);
  check('reduced: headline not pinned', r.pos === 'static', `position=${r.pos}`);
  check('reduced: copy intact', /your font/i.test(r.text) && /one place/i.test(r.text), `"${r.text}"`);
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
