const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
  `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
const base = process.env.TUNER_URL || 'http://127.0.0.1:5173';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    if (process.env.RELEASE_CHECK) {
      const requests = []; page.on('request', request => requests.push(request.url()));
      await page.goto(`${base}/?tuning=1&playtest=1`); await page.waitForSelector('#game-menu[data-state="MENU"]');
      assert.equal(await page.getByRole('link', { name: /TOOLS|ANIMATION VIEWER/ }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'TOOLS', exact: true }).count(), 0);
      await page.keyboard.press('F3'); assert.equal(await page.locator('.quick-tuner').count(), 0);
      assert.equal(requests.some(url => /gameplayPlaytest|gameplayPresets|GameplayTuner/.test(url)), false);
      assert.deepEqual(errors, []); console.log('Release: no tools, no tuning requests, F3 disabled.'); return;
    }
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('game.start();', 'window.__game = game; game.start();') });
    });
    await page.goto(`${base}/`);
    await page.getByRole('button', { name: 'TOOLS', exact: true }).click();
    await page.getByRole('link', { name: 'GAMEPLAY TUNER', exact: true }).click();
    await page.waitForSelector('#settings .tuning-row');
    const set = async (path, value) => {
      const input = page.locator(`[id="tuning-${path}"]`); await input.fill(String(value)); await input.press('Tab');
    };
    await set('player.gravity',300); await set('player.speed',125); await set('player.jumpSpeed',260);
    assert.match(await page.locator('#dirty').innerText(), /3 OVERRIDES/);
    await page.locator('#show-changes').click(); assert.match(await page.locator('#changes').innerText(), /600 → 300/);
    await page.locator('#search').fill('coyote'); assert.equal(await page.locator('.tuning-row:visible').count(),1);
    await page.locator('#search').fill('');
    await page.locator('#preset-name').fill('QA test'); await page.locator('#save-preset').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('iron-signal-dev-presets-v1')));
    assert.equal(saved[0].overrides['player.gravity'],300);
    const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
    const download = await downloadPromise; assert.equal(download.suggestedFilename(), 'gameplay-preset.json');
    await page.locator('#import').setInputFiles({ name:'bad.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify({version:1,name:'Bad',overrides:{'player.gravity':-1}})) });
    await page.waitForFunction(() => document.querySelector('#tuner-error').textContent.includes('inválido'));
    assert.match(await page.locator('#dirty').innerText(), /3 OVERRIDES/);
    await page.locator('#playtest').click(); await page.waitForFunction(() => window.__game?.states.state === 'PLAYING');
    assert.equal(await page.evaluate(() => __game.config.get().player.gravity),300);
    await page.keyboard.press('F3'); assert.equal(await page.locator('.quick-tuner').isVisible(),true);
    const ticks = await page.evaluate(() => __game.ticks); await page.waitForTimeout(150); assert.equal(await page.evaluate(() => __game.ticks),ticks);
    await set('player.maxHealth',10); assert.equal(await page.evaluate(() => __game.player.health),1);
    await page.locator('[data-command="heal"]').click(); assert.equal(await page.evaluate(() => __game.player.health),10);
    await page.locator('[data-command="machineGun"]').click(); assert.equal(await page.evaluate(() => __game.player.weapon.name),'MACHINE GUN');
    await page.locator('[data-command="invulnerable"]').click(); await page.locator('[data-command="infiniteLives"]').click();
    assert.equal(await page.locator('[data-command="invulnerable"]').getAttribute('aria-pressed'),'true');
    await page.locator('#pause-editing').uncheck(); await page.waitForFunction(t => __game.ticks > t,ticks);
    await page.locator('#pause-editing').check(); await set('player.gravity',600);
    assert.equal(await page.evaluate(() => __game.config.get().player.gravity),600);
    // Isolated physics probe through the actual runtime Player, then restore its position.
    const velocity = await page.evaluate(() => {
      const g=__game, p=g.player, saved={...p.position}; p.position.y=150; p.velocity.y=0; p.grounded=false;
      p.update(.01,{left:false,right:true,up:false,down:false,shoot:false,jumpPressed:false},g.collision,[],g.levelData.width);
      const result={...p.velocity}; Object.assign(p.position,saved); return result;
    });
    assert.equal(velocity.x,125); assert.equal(velocity.y,-6);
    await page.locator('#quick-reset').click(); assert.equal(await page.evaluate(() => __game.config.get().player.speed),95);
    assert.equal(await page.evaluate(() => __game.player.health),1);
    await page.locator('.quick-tuner a').click(); await page.waitForSelector('#dirty'); assert.match(await page.locator('#dirty').innerText(), /DEFAULT/);
    await page.locator('#presets').selectOption({label:'QA test'}); await page.locator('#load-preset').click();
    assert.equal(await page.locator('[id="tuning-player.gravity"]').inputValue(),'300');
    await page.goto(`${base}/`); await page.waitForFunction(() => window.__game?.states.state === 'MENU');
    assert.equal(await page.evaluate(() => __game.config.get().player.gravity),600);
    await page.keyboard.press('F3'); assert.equal(await page.locator('.quick-tuner').count(),0);
    assert.deepEqual(errors, []);
    console.log('Tuner: discovery, controls, validation, search, preset, import/export, diff, playtest, F3 pause/live, commands, reset and default-session isolation passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
