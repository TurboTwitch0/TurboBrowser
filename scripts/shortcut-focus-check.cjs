const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8000/';
const key = 'turbobrowser-shortcuts';
const shortcuts = (...names) => names.map(name => ({ name, url: `https://example.com/${name}` }));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(site).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const peer = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(site);
    await peer.goto(site);
    const update = values => peer.evaluate(({ key, values }) => localStorage.setItem(key, JSON.stringify(values)), { key, values });
    const focused = control => control.evaluate(node => document.activeElement === node);
    const remove = name => page.getByRole('button', { name: `Remove ${name} shortcut`, exact: true });
    const link = name => page.getByRole('link', { name, exact: true });
    const hold = async () => {
      await peer.evaluate(key => {
        navigator.locks.request(`turbobrowser-storage:${key}`, () => new Promise(resolve => { window.releaseShortcutLock = resolve; }));
      }, key);
      await peer.waitForFunction(() => typeof window.releaseShortcutLock === 'function');
      await page.bringToFront();
      return () => peer.evaluate(() => { window.releaseShortcutLock(); delete window.releaseShortcutLock; });
    };

    await update(shortcuts('Alpha', 'Beta', 'Gamma'));
    await link('Beta').waitFor();
    await page.locator('#edit-shortcuts').click();
    await remove('Beta').focus();
    await page.keyboard.press('Enter');
    await remove('Beta').waitFor({ state: 'detached' });
    assert.equal(await focused(remove('Gamma')), true, 'Neighbor retains the Remove control after keyboard removal');
    await update([...shortcuts('Delta', 'Alpha', 'Gamma')]);
    await link('Delta').waitFor();
    assert.equal(await focused(remove('Gamma')), true, 'A peer addition preserves the equivalent focused control');
    await update(shortcuts('Delta', 'Alpha'));
    await remove('Gamma').waitFor({ state: 'detached' });
    assert.equal(await focused(remove('Alpha')), true, 'A peer removal chooses the nearest remaining control');

    const release = await hold();
    await page.keyboard.press('Enter');
    assert.equal(await remove('Alpha').getAttribute('aria-disabled'), 'true');
    assert.equal(await focused(remove('Alpha')), true, 'A pending removal stays keyboard focused');
    await page.keyboard.press('Enter'); // repeated activation must not queue a second removal
    const search = page.locator('#search-input');
    await search.fill('keep this focused');
    await release();
    await remove('Alpha').waitFor({ state: 'detached' });
    assert.equal(await focused(search), true, 'Storage completion respects newer focus');
    assert.equal(await search.inputValue(), 'keep this focused');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await remove('Alpha').waitFor();

    const releaseRename = await hold();
    await remove('Alpha').focus();
    await page.keyboard.press('Enter');
    await update([...shortcuts('Delta'), { ...shortcuts('Alpha')[0], name: 'Renamed Alpha' }]);
    await remove('Renamed Alpha').waitFor();
    await releaseRename();
    await page.getByText(/This shortcut changed in another tab/).waitFor();
    assert.equal(await focused(remove('Renamed Alpha')), true);
    assert.ok((await peer.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).some(item => item.name === 'Renamed Alpha'));
    await update([]);
    await link('Renamed Alpha').waitFor({ state: 'detached' });
    assert.equal(await focused(page.locator('#add-shortcut')), true, 'An emptied launchpad focuses Add a shortcut');
    assert.deepEqual(errors, []);
    console.log('Shortcut focus passed: keyboard removal, peer changes, delayed focus, Undo, stale removal and empty recovery.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
