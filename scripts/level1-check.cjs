const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
  `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replaceAll('game.start();', 'window.g=game;game.start();') });
    });
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'COMENZAR', exact: true }).click();
    const result = await page.evaluate(async () => {
      g.loop.stop(); await g.assets.preload();
      const p = g.player, surfaces = [...g.level.solids, ...g.level.oneWays];
      const { PLAYER } = await import('/src/config/constants.ts');
      const steps = Math.ceil(PLAYER.jumpSpeed / (PLAYER.gravity / 60)) - 1;
      const jumpHeight = steps * PLAYER.jumpSpeed / 60 - PLAYER.gravity / 3600 * steps * (steps + 1) / 2;
      // Protect only against damage: retain actual movement, terrain, weapons and pickups.
      g.devInvulnerable = true;
      g.input.setTouchAction('right', true); g.input.setTouchAction('shoot', true);
      for (let n = 0; n < 16000 && !g.boss.active; n++) {
        const supports = surfaces.filter(s => Math.abs(s.y + s.height - p.position.y) < .001
          && p.position.x < s.x + s.width && p.position.x + p.width > s.x);
        const edge = supports.length > 0 && Math.max(...supports.map(s => s.x + s.width)) - p.position.x < 5;
        const wall = g.level.solids.some(s => s.x >= p.position.x + p.width && s.x - p.position.x - p.width < 12
          && s.y + s.height > p.position.y && s.y < p.position.y + p.height);
        const higher = g.level.oneWays.some(s => s.y + s.height > p.position.y + .001
          && s.y + s.height - p.position.y <= jumpHeight && p.position.x < s.x + s.width && p.position.x + p.width > s.x);
        g.input.setTouchAction('jump', p.grounded && (edge || wall || higher || p.velocity.x === 0));
        g.update(1 / 60);
        if (!p.alive) throw Error(`Player fell at X=${p.position.x}`);
        if (n % 120 === 0) g.render();
      }
      if (!g.boss.active || g.combat.kills < 1 || g.powerups.collectedCount < 1)
        throw Error(`Traversal/combat/pickups failed: ${p.position.x}, ${g.combat.kills}, ${g.powerups.collectedCount}`);
      const traversal = { jumps: p.jumpCount, kills: g.combat.kills, pickups: g.powerups.collectedCount,
        checkpoint: g.checkpoints.current.x, bossActivatedAt: p.position.x };
      g.input.setTouchAction('right', false); g.input.setTouchAction('jump', false);
      for (let n = 0; n < 12000 && g.boss.alive; n++) { g.update(1 / 60); if (n % 120 === 0) g.render(); }
      if (g.boss.alive || g.states.state !== 'LEVEL_COMPLETE' || g.transitionRemaining !== 3)
        throw Error(`Boss combat failed: health=${g.boss.health}, state=${g.states.state}`);
      g.input.clear(); for (let n = 0; n < 60; n++) g.update(1 / 60);
      g.render(); window.completedLevel1 = g;
      return { ...traversal, bossDefeated: true, render: { calls: g.renderer.info.render.calls,
        textures: g.renderer.info.memory.textures, geometries: g.renderer.info.memory.geometries } };
    });
    await page.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'iron-signal-reviewed-level1-boss.png') });
    await page.evaluate(() => { for (let n = 0; n < 120; n++) g.update(1 / 60); });
    await page.waitForFunction(() => g !== completedLevel1 && g.levelData.id === 'level-02' && g.states.state === 'PLAYING');
    assert.deepEqual(errors, []);
    console.log('Edited Level 1: real traversal, jumps, combat, pickups, checkpoints, boss defeat and delayed campaign transition passed.', result);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
