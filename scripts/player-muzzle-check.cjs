const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
  `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replaceAll('game.start();', 'window.g=game;game.start();') });
    });
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'COMENZAR', exact: true }).click();
    await page.evaluate(async () => {
      g.loop.stop(); await g.assets.preload();
      const spawn = g.projectiles.spawn.bind(g.projectiles);
      g.projectiles.spawn = (...args) => {
        const ok = spawn(...args);
        if (ok && args[5] === 'player') {
          const p = g.projectiles.items.findLast(p => p.active && p.fresh);
          if (!window.firstShot) window.firstShot = { position: { ...p.position }, velocity: { ...p.velocity } };
          // Spread's middle pellet is the one aligned with the selected aim.
          if (Math.abs(p.velocity.x / g.player.weapon.projectileSpeed - g.player.aimDirection.x) < 1e-8
            && Math.abs(p.velocity.y / g.player.weapon.projectileSpeed - g.player.aimDirection.y) < 1e-8)
            window.centralShot = { position: { ...p.position } };
        }
        return ok;
      };
    });
    const cases = [
      ['standing', true, false, false, false, 'shoot_horizontal'],
      ['running', true, false, false, true, 'runShoot_horizontal'],
      ['crouching', true, true, false, false, 'crouchShoot_horizontal'],
      ['airborne', false, false, false, false, 'jumpShoot_horizontal'],
      ['up', true, false, true, false, 'shoot_up'],
      ['diagonal-up', true, false, true, true, 'runShoot_diagonal'],
      ['down', false, true, false, false, 'jumpShoot_down'],
      ['diagonal-down', false, true, false, true, 'jumpShoot_diagonalDown'],
    ];
    for (const weapon of ['Rifle', 'MachineGun', 'SpreadGun', 'Laser']) for (const facing of [1, -1]) for (const [name, grounded, down, up, move, clip] of cases) {
      const result = await page.evaluate(async ({ weapon, facing, grounded, down, up, move }) => {
        const module = await import(`/src/weapons/${weapon}.ts`), p = g.player;
        g.projectiles.clear(); g.fxSprites.clear(); g.lighting.clear(); g.enemies.clear(); g.input.clear();
        g.lighting.enabled = true; p.weapon = new module[weapon]();
        p.position.x = 200.25; p.position.y = grounded ? 44 : 145.25;
        p.velocity.x = p.velocity.y = 0; p.height = 26; p.grounded = grounded; p.direction = facing;
        p.invulnerabilityTimer = 0; window.centralShot = window.firstShot = null;
        g.input.setTouchAction(facing > 0 ? 'right' : 'left', move);
        g.input.setTouchAction('up', up); g.input.setTouchAction('down', down); g.input.setTouchAction('shoot', true);
        g.update(1 / 60); g.render();
        const fx = g.fxSprites.slots.find(s => s.life > 0 && s.id.startsWith('fx.muzzle.'));
        const light = g.lighting.slots.find(s => s.active);
        const shot = centralShot || firstShot, texture = g.assets.getTexture(g.playerView.sprite.assetId);
        return { sprite: g.playerView.sprite.assetId, real: !!texture, gunHidden: !g.playerView.gun.visible,
          shot: [Math.round(shot.position.x), Math.round(shot.position.y)],
          flash: [fx.root.position.x, fx.root.position.y], light: [light.x, light.y] };
      }, { weapon, facing, grounded, down, up, move });
      assert.equal(result.sprite, `player.${clip}`, `${weapon} ${name}`); assert(result.real && result.gunHidden);
      assert.deepEqual(result.shot, result.flash, `${weapon} ${name} facing ${facing}: bullet/flash`);
      assert.deepEqual(result.flash, result.light, `${weapon} ${name} facing ${facing}: flash/light`);
      if (weapon === 'Rifle' && facing === 1)
        await page.locator('#viewport canvas').screenshot({ path: require('node:path').join(require('node:os').tmpdir(), `iron-signal-muzzle-${name}.png`) });
      const next = await page.evaluate(() => {
        g.update(1 / 60); g.render();
        const fx = g.fxSprites.slots.find(s => s.life > 0 && s.id.startsWith('fx.muzzle.'));
        const light = g.lighting.slots.find(s => s.active);
        return { flash: [fx.root.position.x, fx.root.position.y], light: [light.x, light.y],
          muzzle: [g.playerMuzzleSource.position.x, g.playerMuzzleSource.position.y] };
      });
      assert.deepEqual(next.flash, next.muzzle, `${weapon} ${name}: moving muzzle`);
      assert.deepEqual(next.light, next.muzzle, `${weapon} ${name}: moving light`);
    }
    assert.deepEqual(errors, []);
    console.log('Player muzzle passed: real sprites, four weapons, eight poses, both facings; bullet spawn, flash and light share the same rendered point.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
