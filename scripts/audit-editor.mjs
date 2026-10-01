// Editor audit: proves the canvas actually paints ink, strokes persist, layout
// holds at every breakpoint, and the save actions stay reachable.
// Run: node scripts/audit-editor.mjs

const { chromium } = await import('playwright');

const VIEWPORTS = [
  [1440, 900, 'desktop'],
  [1024, 768, 'tablet'],
  [768, 1024, 'tablet-portrait'],
  [390, 844, 'mobile'],
];

const USER = {
  phone: '9999999999',
  name: 'Audit',
  isLoggedIn: true,
  tier: 'creator',
  fontsCreatedCount: 1,
  totalDownloads: 0,
};

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');

const PROJECT = {
  id: 'p1',
  name: 'Audit Hand',
  description: 'audit',
  author: 'Audit',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  characters: Object.fromEntries(
    CHARS.map((c, i) => [
      c,
      {
        char: c,
        unicode: c.charCodeAt(0),
        category: i < 26 ? 'uppercase' : i < 52 ? 'lowercase' : 'numbers',
        strokes: [],
        qualityStatus: 'empty',
      },
    ]),
  ),
  status: 'draft',
  characterCount: 62,
  completionPercentage: 0,
};

const browser = await chromium.launch();
const results = [];
const check = (n, pass, d = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${n}${d ? '  ' + d : ''}`);
};

const openEditor = async (page) => {
  await page.addInitScript(
    ([user, project]) => {
      localStorage.setItem('typeme_user', JSON.stringify(user));
      localStorage.setItem('typeme_projects', JSON.stringify([project]));
    },
    [USER, PROJECT],
  );
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // The dashboard can be mid-hydration; retry the project entry until the
  // workspace character grid is actually mounted.
  let write = page.locator('button[aria-label="Write A"]').first();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const cont = page.locator('button', { hasText: /Continue/ }).first();
    if (await cont.count()) {
      await cont.click({ timeout: 5000 }).catch(() => {});
    }
    try {
      await write.waitFor({ state: 'visible', timeout: 4000 });
      break;
    } catch {
      /* retry */
    }
  }
  await write.click({ timeout: 10000 });
  await page.waitForSelector('canvas', { timeout: 5000 });
  await page.waitForTimeout(400);
};

// Reads back how many dark pixels the canvas currently holds.
const inkCount = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return -1;
    const ctx = c.getContext('2d');
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 140 && data[i + 1] < 140 && data[i + 2] < 140 && data[i + 3] > 40) n += 1;
    }
    return n;
  });

// Draws three strokes using real pointer events at viewport coordinates.
const drawStrokes = async (page) => {
  const box = await page.locator('canvas').boundingBox();
  const pts = [
    [0.2, 0.7],
    [0.35, 0.35],
    [0.5, 0.7],
    [0.65, 0.35],
    [0.8, 0.7],
  ];
  for (const [ox, oy] of pts) {
    const x = box.x + box.width * ox;
    const y = box.y + box.height * oy;
    await page.mouse.move(x - 24, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(x - 24 + i * 6, y - Math.sin((i / 8) * Math.PI) * 18);
    }
    await page.mouse.up();
  }
  await page.waitForTimeout(250);
};

// Draws one stroke through synthetic PointerEvents so the touch and stylus
// code paths (coordinate mapping, palm rejection) are covered too.
const synthStroke = async (page, pointerType, row = 0.5) => {
  await page.evaluate(
    ([type, yFrac]) => {
      const c = document.querySelector('[data-testid="editor-canvas"]');
      if (!c) return;
      const r = c.getBoundingClientRect();
      const y = r.top + r.height * yFrac;
      const fire = (name, x, yy) =>
        c.dispatchEvent(
          new PointerEvent(name, {
            pointerId: 7,
            pointerType: type,
            isPrimary: true,
            clientX: x,
            clientY: yy,
            bubbles: true,
            cancelable: true,
            buttons: name === 'pointerup' ? 0 : 1,
          }),
        );
      fire('pointerdown', r.left + r.width * 0.25, y);
      for (let i = 1; i <= 6; i += 1) {
        fire('pointermove', r.left + r.width * (0.25 + i * 0.08), y + Math.sin(i) * 14);
      }
      fire('pointerup', r.left + r.width * 0.73, y);
    },
    [pointerType, row],
  );
  await page.waitForTimeout(200);
};

for (const [w, h, label] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)));

  await openEditor(page);

  const box = await page.locator('canvas').boundingBox();
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  check(`${label}: canvas visible`, !!box && box.width > 120 && box.height > 120, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'missing');
  check(`${label}: canvas square`, !!box && Math.abs(box.width - box.height) < 3, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : '');
  const backing = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c ? [c.width, c.height] : [0, 0];
  });
  check(`${label}: DPR-aware backing store`, backing[0] === Math.round(box.width * dpr), `${backing[0]}px backing, dpr=${dpr}`);

  const before = await inkCount(page);
  await drawStrokes(page);
  const after = await inkCount(page);
  check(`${label}: ink renders on canvas`, after > before + 200, `${before} -> ${after} dark px`);

  const strokes = await page
    .locator('[data-testid="editor-stroke-count"]')
    .first()
    .textContent()
    .catch(() => '');
  check(`${label}: strokes recorded`, /^5 strokes$/.test((strokes || '').trim()), `"${(strokes || '').trim()}"`);

  // Strokes must survive a pointer release and a re-render (no reset).
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  const stable = await inkCount(page);
  check(`${label}: ink persists after release`, stable === after, `${after} -> ${stable}`);

// Layout: a real wheel gesture must not move the page behind the editor, the
  // editor itself must not overflow, and the save actions stay reachable.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.mouse.move(w / 2, h / 2);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(250);
  const scrolled = await page.evaluate(() => window.scrollY);
  check(`${label}: page cannot scroll`, scrolled === 0, `scrollY=${scrolled}`);
  const layout = await page.evaluate(() => {
    const editor = document.querySelector('[data-testid="handwriting-editor"]');
    const aside = document.querySelector('aside');
    const scrollable = aside
      ? [...aside.querySelectorAll('*')].some(
          (el) => el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY !== 'hidden',
        )
      : false;
    const buttons = Array.from(document.querySelectorAll('button')).map((b) => {
      const r = b.getBoundingClientRect();
      return { text: b.textContent.trim(), visible: r.top >= 0 && r.bottom <= innerHeight + 1 && r.width > 0 };
    });
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      editorOverflowX: editor ? editor.scrollWidth - editor.clientWidth : 0,
      editorOverflowY: editor ? editor.scrollHeight - editor.clientHeight : 0,
      scrollable,
      save: buttons.find((b) => b.text === 'Save')?.visible ?? false,
      next: buttons.find((b) => /Save & Next/.test(b.text))?.visible ?? false,
      undo: buttons.find((b) => /^Undo/.test(b.text))?.visible ?? false,
      redo: buttons.find((b) => /^Redo/.test(b.text))?.visible ?? false,
    };
  });
  check(`${label}: page scroll locked`, layout.bodyOverflow === 'hidden', `body overflow=${layout.bodyOverflow}`);
  check(`${label}: editor does not overflow`, layout.editorOverflowX <= 0 && layout.editorOverflowY <= 0, `x=${layout.editorOverflowX} y=${layout.editorOverflowY}`);
  check(`${label}: no horizontal overflow`, layout.editorOverflowX <= 0, `overflow=${layout.editorOverflowX}px`);
  check(`${label}: Save + Save & Next visible`, layout.save && layout.next);
  check(`${label}: Undo + Redo visible`, layout.undo && layout.redo);

  // Undo / redo behaviour.
  await page.locator('button', { hasText: /^Undo$/ }).first().click();
  await page.waitForTimeout(300);
  const undone = await inkCount(page);
  check(`${label}: undo removes last stroke`, undone < after, `${after} -> ${undone}`);
  await page.locator('button', { hasText: /^Redo$/ }).first().click();
  await page.waitForTimeout(300);
  const redone = await inkCount(page);
  check(`${label}: redo restores stroke`, redone === after, `${after} -> ${redone}`);

  // Save & Next must persist and advance to an unwritten character.
  await page.locator('button', { hasText: /Save & Next/ }).first().click();
  await page.waitForTimeout(900);
  const afterNext = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('typeme_projects') || '[]');
    const p = raw[0];
    return {
      filled: Object.values(p.characters || {}).filter((c) => c.strokes?.length).map((c) => c.char),
      current: document.querySelector('[data-testid="editor-current-char"]')?.textContent?.trim() || '',
      strokeCount: document.querySelector('[data-testid="editor-stroke-count"]')?.textContent?.trim() || '',
    };
  });
  check(`${label}: save persisted strokes`, afterNext.filled.includes('A'), `filled=[${afterNext.filled.join(',')}]`);
  check(`${label}: Save & Next advanced to next unwritten`, afterNext.current === 'B', `now "${afterNext.current}"`);
  check(`${label}: next character starts empty`, /^0 strokes$/.test(afterNext.strokeCount), `"${afterNext.strokeCount}"`);

  const dot = await page.locator('aside button[aria-label="A, completed"]').first().count();
  check(`${label}: completed dot exposed`, dot === 1);

  // Touch and stylus input paths on the fresh character.
  const touchBefore = await inkCount(page);
  await synthStroke(page, 'touch', 0.38);
  const touchAfter = await inkCount(page);
  check(`${label}: touch input draws`, touchAfter > touchBefore + 100, `${touchBefore} -> ${touchAfter}`);

  const penBefore = await inkCount(page);
  await synthStroke(page, 'pen', 0.66);
  const penAfter = await inkCount(page);
  check(`${label}: stylus input draws`, penAfter > penBefore + 100, `${penBefore} -> ${penAfter}`);

  const finalStrokes = await page.locator('[data-testid="editor-stroke-count"]').first().textContent();
  check(`${label}: touch + stylus strokes counted`, /^2 strokes$/.test((finalStrokes || '').trim()), `"${(finalStrokes || '').trim()}"`);

  // Eraser must actually remove ink.
  const toolsTab = page.locator('aside button', { hasText: /^Tools$/ });
  if ((await toolsTab.count()) && (await toolsTab.first().isVisible())) {
    await toolsTab.first().click();
    await page.waitForTimeout(200);
  }
  await page.locator('button', { hasText: /^eraser$/i }).first().click();
  await page.waitForTimeout(150);
  const eraseBefore = await inkCount(page);
  await synthStroke(page, 'mouse', 0.38);
  const eraseAfter = await inkCount(page);
  check(`${label}: eraser removes ink`, eraseAfter < eraseBefore, `${eraseBefore} -> ${eraseAfter}`);

// The eraser ring must sit exactly under the pointer (stage-relative math).
  const center = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="handwriting-stage"]')?.getBoundingClientRect();
    return s ? { x: s.left + s.width / 2, y: s.top + s.height / 2 } : null;
  });
  if (center) {
    await page.mouse.move(center.x + 6, center.y + 6);
    await page.waitForTimeout(60);
    await page.mouse.move(center.x, center.y);
    await page.waitForTimeout(150);
  }
  const ringProbe = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="handwriting-stage"]')?.getBoundingClientRect();
    const ringEl = document.querySelector('[data-testid="eraser-ring"]');
    const ring = ringEl?.getBoundingClientRect();
    return stage && ring
      ? {
          dx: ring.left + ring.width / 2 - (stage.left + stage.width / 2),
          dy: ring.top + ring.height / 2 - (stage.top + stage.height / 2),
          w: Math.round(ring.width),
          left: ringEl.style.left,
        }
      : null;
  });
  check(
    `${label}: eraser ring tracks the pointer`,
    !!ringProbe && Math.abs(ringProbe.dx) < 2 && Math.abs(ringProbe.dy) < 2,
    ringProbe
      ? `offset ${ringProbe.dx.toFixed(1)},${ringProbe.dy.toFixed(1)}px size ${ringProbe.w}px left=${ringProbe.left}`
      : 'no ring',
  );

  // Clear empties the canvas and resets the counter.
  await page.locator('button', { hasText: /^Clear$/ }).first().click();
  await page.waitForTimeout(300);
  const cleared = await page.locator('[data-testid="editor-stroke-count"]').first().textContent();
  const clearedInk = await inkCount(page);
  check(`${label}: clear resets canvas`, /^0 strokes$/.test((cleared || '').trim()), `"${(cleared || '').trim()}"`);
  check(`${label}: cleared canvas has no ink`, clearedInk === 0, `${clearedInk} dark px`);

  // The controls disclosure must toggle (mobile-first collapse).
  const disclosure = page.locator('aside button[aria-label="Hide controls"]');
  if (await disclosure.count()) {
    if (await disclosure.first().isVisible()) {
      await disclosure.first().click();
      await page.waitForTimeout(150);
      const collapsed = await page.locator('aside button[aria-label="Show controls"]').count();
      check(`${label}: controls can be collapsed`, collapsed === 1);
      await page.locator('aside button[aria-label="Show controls"]').first().click();
      await page.waitForTimeout(150);
    } else {
      console.log(`--   ${label}: controls disclosure is desktop-only`);
    }
  }

  // No scroll view inside the left panel: every control must fit the viewport.
  const panelFit = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return { scrolls: true, overflow: 0, bottom: 0 };
    const scrollers = [...aside.querySelectorAll('*')].filter(
      (el) => el.scrollHeight > el.clientHeight + 2 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY),
    );
    let lowest = 0;
    aside.querySelectorAll('button, p, dl').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) lowest = Math.max(lowest, r.bottom);
    });
    return { scrolls: scrollers.length > 0, overflow: aside.scrollHeight - aside.clientHeight, bottom: Math.round(lowest) };
  });
  check(`${label}: left panel does not scroll`, !panelFit.scrolls && panelFit.overflow <= 1, `overflow=${panelFit.overflow}px scrollers=${panelFit.scrolls}`);
  check(`${label}: left panel fits the viewport`, panelFit.bottom <= h + 1, `lowest control at ${panelFit.bottom}px of ${h}px`);

  // Shortcut sheet floats over the panel without reflowing it.
  const asideBefore = await page.evaluate(() => {
    const a = document.querySelector('aside');
    return a ? a.getBoundingClientRect().height : 0;
  });
  await page.locator('button[aria-label="Keyboard shortcuts"]').first().click();
  await page.waitForTimeout(320);
  const shortcuts = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="editor-shortcuts"]');
    const a = document.querySelector('aside');
    const r = panel?.getBoundingClientRect();
    return {
      visible: !!panel && getComputedStyle(panel).opacity === '1' && !!r && r.height > 40,
      inside: !!r && !!a && r.bottom <= a.getBoundingClientRect().bottom + 1 && r.right <= a.getBoundingClientRect().right + 1,
      asideHeight: a ? a.getBoundingClientRect().height : 0,
    };
  });
  check(`${label}: shortcut sheet opens`, shortcuts.visible);
  check(`${label}: shortcut sheet stays inside the panel`, shortcuts.inside);
  check(`${label}: shortcut sheet does not resize the panel`, Math.abs(shortcuts.asideHeight - asideBefore) < 1.5, `${asideBefore} -> ${shortcuts.asideHeight}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);