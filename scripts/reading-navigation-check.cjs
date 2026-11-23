/* Optional Playwright checks against the real, locally served reading list. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8000/';
const key = 'turbobrowser-saved';
const article = title => ({ title, url: `https://en.wikipedia.org/wiki/${title}`, kind: 'Planet', description: 'Solar system' });
const initial = ['Mercury', 'Venus', 'Earth'].map(article);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const checks = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const peer = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const seed = async values => {
      await page.goto(site);
      await page.evaluate(({ key, values }) => localStorage.setItem(key, JSON.stringify(values)), { key, values });
      await page.goto(new URL('#reading-list', site).href, { waitUntil: 'domcontentloaded' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(count => document.querySelectorAll('.daily-card').length === count, values.length);
    };
    const focused = async selector => assert.equal(await page.locator(selector).evaluate(node => node === document.activeElement), true, selector);
    const remove = async index => {
      const count = await page.locator('.save-article').count();
      await page.locator('.save-article').nth(index).focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(count => document.querySelectorAll('.save-article').length === count - 1, count);
    };
    await seed(initial);
    await remove(1);
    await focused('.daily-card:last-child .save-article');
    assert.match(await page.locator('.daily-card:last-child .save-article').getAttribute('aria-label'), /Earth/);
    await remove(1);
    await focused('.save-article');
    await remove(0);
    await focused('.state-actions button');
    checks.push('Keyboard removals keep the next read, previous final read, then empty-list recovery focused');

    await seed(initial);
    await page.locator('#saved-search').fill('earth');
    await remove(0);
    await focused('.state-actions button');
    await page.keyboard.press('Enter');
    await focused('#saved-search');
    assert.equal(await page.locator('.daily-card').count(), 2);
    checks.push('Removing the only search match focuses Clear search and returns to the unchanged remaining list');

    await seed(initial);
    await page.locator('.article-link').nth(1).focus();
    await peer.goto(site);
    const updateFromPeer = async values => {
      await peer.evaluate(({ key, values }) => localStorage.setItem(key, JSON.stringify(values)), { key, values });
      await page.waitForFunction(count => document.querySelectorAll('.daily-card').length === count, values.length);
    };
    await updateFromPeer([article('Mars'), ...initial]);
    await focused('.daily-card:nth-child(3) .article-link');
    await updateFromPeer([article('Mars'), initial[0], initial[2]]);
    await focused('.daily-card:last-child .article-link');
    await updateFromPeer([]);
    await focused('.state-actions button');
    await seed([initial[0]]);
    await page.locator('#saved-search').focus();
    await updateFromPeer([]);
    await focused('.state-actions button');
    checks.push('Real peer-tab changes retain the article or neighbor; an emptied list moves hidden search focus to recovery');

    await seed(initial);
    await peer.evaluate(() => {
      window.heldReadingLock = navigator.locks.request('turbobrowser-storage:turbobrowser-saved', () => new Promise(resolve => { window.releaseReadingLock = resolve; }));
    });
    await peer.waitForFunction(() => Boolean(window.releaseReadingLock));
    await page.locator('.save-article').first().click();
    await page.locator('#saved-search').focus();
    await peer.evaluate(() => window.releaseReadingLock());
    await page.waitForFunction(() => document.querySelectorAll('.daily-card').length === 2);
    await focused('#saved-search');
    checks.push('A queued save does not steal focus from a field chosen while the write was waiting');

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await seed(initial);
      await remove(1);
      await focused('.daily-card:last-child .save-article');
      const geometry = await page.locator('.daily-card:last-child .save-article').evaluate(node => {
        const box = node.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return { y: box.y, bottom: box.bottom, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1, unobstructed: node.contains(hit) };
      });
      assert.ok(geometry.y >= 0 && geometry.bottom <= geometry.height && !geometry.overflow && geometry.unobstructed, JSON.stringify(geometry));
    }
    checks.push('390px and 320px removals retain a visible focus target above the Undo toast without horizontal overflow');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, site, checks }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
