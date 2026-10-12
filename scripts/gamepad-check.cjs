const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
  `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.testPad = { id: 'Xbox standard (simulated)', mapping: 'standard', connected: true,
        axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      Object.defineProperty(navigator, 'getGamepads', { value: () => testPad.connected ? [null, testPad] : [] });
    });
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('game.start();', 'window.g = game; game.start();') });
    });
    const button = (index, pressed) => page.evaluate(({index, pressed}) => {
      testPad.buttons[index].pressed = pressed;
      testPad.buttons[index].value = pressed ? 1 : 0;
    }, {index, pressed});
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForFunction(() => window.g?.states.state === 'MENU');
    assert.match(await page.locator('#gamepad-status').innerText(), /Xbox standard/);
    await button(0, true); await page.waitForFunction(() => g.states.state === 'PLAYING');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => g.player.jumpCount), 0); // Menu confirmation must not jump.
    await button(0, false);
    await page.evaluate(() => { g.player.invulnerabilityTimer = 1000; testPad.axes = [0.1, -0.1]; });
    await page.waitForFunction(() => !g.input.isDown('right') && !g.input.isDown('up'));
    await page.evaluate(() => { testPad.axes = [0.8, -0.8]; testPad.buttons[7].value = 0.8; });
    await page.waitForFunction(() => g.player.velocity.x > 0 && g.player.aimDirection.y > 0 && g.projectiles.playerSpawned > 0);
    await button(0, true); await page.waitForFunction(() => g.player.velocity.y > 0);
    await button(0, false);
    await page.evaluate(() => { testPad.axes = [-0.8, 0.8]; });
    await page.waitForFunction(() => !g.player.grounded && g.player.aimDirection.x < 0 && g.player.aimDirection.y < 0);
    await page.evaluate(() => { testPad.axes = [0,0]; testPad.buttons[7].value = 0; });
    await button(9, true); await page.waitForFunction(() => g.states.state === 'PAUSED');
    await page.waitForTimeout(150); assert.equal(await page.evaluate(() => g.states.state), 'PAUSED');
    await button(9, false); await page.waitForTimeout(50);
    await button(9, true); await page.waitForFunction(() => g.states.state === 'PLAYING');
    await page.waitForTimeout(150); assert.equal(await page.evaluate(() => g.states.state), 'PLAYING');
    await button(9, false); await button(2, true);
    await page.waitForFunction(() => g.input.isDown('shoot'));
    await page.evaluate(() => { testPad.connected = false; });
    await page.waitForFunction(() => !g.input.isDown('shoot'));
    await page.keyboard.down('d'); await page.waitForFunction(() => g.player.velocity.x > 0); await page.keyboard.up('d');
    await page.evaluate(() => { testPad.connected = true; window.dispatchEvent(new Event('blur')); });
    await page.waitForFunction(() => g.states.state === 'PAUSED' && !g.input.isDown('shoot'));
    await page.evaluate(() => { testPad.buttons[2].pressed = false; testPad.buttons[2].value = 0; window.dispatchEvent(new Event('focus')); });
    await button(0, true); await page.waitForFunction(() => g.states.state === 'PLAYING');
    await page.reload(); await page.waitForFunction(() => window.g?.states.state === 'MENU');
    await button(13, true); await page.waitForFunction(() => document.activeElement?.textContent === 'BOSS RUN');
    await button(13, false); await page.waitForTimeout(50);
    await button(0, true); await page.waitForURL('**/?mode=boss');
    await page.waitForFunction(() => window.g?.states.state === 'PLAYING' && g.player.position.x > 8000);
    assert.deepEqual(errors, []);
    console.log('Gamepad passed: A/start, stick deadzone, diagonal aiming, RT/X fire, jump, lower aim, pause hold/resume, disconnect, keyboard fallback, blur/focus and Boss Run menu navigation.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
