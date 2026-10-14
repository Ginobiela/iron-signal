const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('game.start();', 'window.g = game; game.start();') });
    });
    await page.goto(process.env.MENU_CHECK_URL || 'http://127.0.0.1:5173/');
    const menu = page.locator('#game-menu');
    await menu.getByRole('button', { name: 'COMENZAR', exact: true }).waitFor();
    async function checkGroups() {
      assert.equal(await menu.getByRole('link').count(), 1); // Only Boss Run at root.
      await menu.getByRole('button', { name: 'SELECT LEVEL', exact: true }).click();
      assert.equal(await menu.getByRole('link').count(), 3);
      assert.equal(await menu.getByRole('link', { name: /LEVEL 3/ }).getAttribute('href'), './?level=levels/level-03.json');
      await page.keyboard.press('Escape');
      await menu.getByRole('button', { name: 'TOOLS', exact: true }).click();
      for (const [label, href] of [['GAMEPLAY TUNER','./gameplay-tuner.html'],['SPRITE VIEWER','./animation-viewer.html'],['LEVEL EDITOR','./level-editor.html']]) {
        assert.equal(await menu.getByRole('link', { name: label, exact: true }).getAttribute('href'), href);
      }
      await menu.getByRole('button', { name: 'VOLVER', exact: true }).click();
    }
    await checkGroups();
    await menu.getByRole('button', { name: 'COMENZAR', exact: true }).click();
    await page.waitForFunction(() => g.states.state === 'PLAYING');
    await page.keyboard.press('Escape');
    await menu.getByRole('button', { name: 'CONTINUAR', exact: true }).waitFor();
    const ticks = await page.evaluate(() => g.player.position.x);
    await checkGroups();
    assert.equal(await page.evaluate(() => g.states.state), 'PAUSED');
    assert.equal(await page.evaluate(() => g.player.position.x), ticks);
    // Enter activates the focused submenu item instead of resuming gameplay.
    await menu.getByRole('button', { name: 'TOOLS', exact: true }).focus();
    await page.keyboard.press('Enter');
    await menu.getByRole('link', { name: 'GAMEPLAY TUNER', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => g.states.state), 'PAUSED');
    await page.keyboard.press('Escape');
    await menu.getByRole('button', { name: 'CONTINUAR', exact: true }).click();
    await page.waitForFunction(() => g.states.state === 'PLAYING');
    await page.keyboard.press('Escape');
    await menu.getByRole('button', { name: 'SELECT LEVEL', exact: true }).click();
    await menu.getByRole('link', { name: /LEVEL 3/ }).click();
    await page.waitForURL('**/?level=levels/level-03.json');
    await menu.getByRole('button', { name: 'COMENZAR', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await menu.getByRole('button', { name: 'TOOLS', exact: true }).click();
    assert.equal(await menu.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    assert.deepEqual(errors, []);
    console.log('Menu passed: grouped start/pause navigation, keyboard Enter/Escape, paused simulation, level switching, tools links and narrow viewport.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
