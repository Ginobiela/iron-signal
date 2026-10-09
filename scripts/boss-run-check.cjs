const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
  `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: `
      import './style.css'; import { Game } from './core/Game';
      window.g = new Game(document.querySelector('#viewport'), document.querySelector('#debug'),
      document.querySelector('#combat-status'), document.querySelector('#powerup-notice'),
      document.querySelector('#game-menu'), document.querySelector('#boss-status'));
      await g.assets.preload(); g.start();
    ` }));
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForFunction(() => window.g?.states.state === 'MENU');
    await page.getByRole('link', { name: 'BOSS RUN', exact: true }).click();
    await page.waitForFunction(() => window.g?.states.state === 'PLAYING' && g.boss.active);
    let state = await page.evaluate(() => ({ x: g.player.position.x, checkpoint: g.checkpoints.current.x,
      arena: g.boss.arenaLeft, enemies: g.enemies.items.length, triggers: g.spawner.triggeredCount, lives: g.states.lives }));
    assert.equal(state.x, state.arena); assert.equal(state.checkpoint, state.arena);
    assert.equal(state.enemies, 0); assert.equal(state.triggers, 0); assert.equal(state.lives, 3);
    await page.waitForFunction(() => g.boss.state === 'TELEGRAPH');
    await page.keyboard.press('Escape');
    const timer = await page.evaluate(() => g.boss.attackTimer);
    await page.waitForTimeout(200); assert.equal(await page.evaluate(() => g.boss.attackTimer), timer);
    await page.keyboard.press('Enter');
    const killPlayer = async () => {
      await page.evaluate(() => { g.player.invulnerabilityTimer = 0; g.projectiles.clear();
        g.projectiles.spawn(g.player.position.x + 6, g.player.position.y + 12, 0, 0, 100, 'enemy'); });
      await page.waitForFunction(() => g.states.state === 'PLAYER_DEAD');
    };
    await killPlayer(); await page.waitForFunction(() => g.states.state === 'PLAYING');
    assert.equal(await page.evaluate(() => g.player.position.x), state.arena);
    await killPlayer(); await page.waitForFunction(() => g.states.state === 'PLAYING');
    await killPlayer(); await page.waitForFunction(() => g.states.state === 'GAME_OVER');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => g.states.state === 'PLAYING' && g.states.lives === 3 && g.boss.active);
    await page.evaluate(() => { g.boss.state = 'RECOVER'; g.boss.attackTimer = 10; g.projectiles.clear();
      g.projectiles.spawn(g.boss.position.x + 10, g.boss.position.y + 20, 0, 0, g.boss.maxHealth, 'player'); });
    await page.waitForFunction(() => g.states.state === 'LEVEL_COMPLETE');
    assert.equal(await page.evaluate(() => g.score.value), 5000);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => g.states.state === 'PLAYING' && g.boss.active && g.boss.phase === 1 && g.boss.health === g.boss.maxHealth);
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForFunction(() => window.g?.states.state === 'MENU');
    await page.keyboard.press('Enter'); await page.waitForFunction(() => g.states.state === 'PLAYING');
    assert.equal(await page.evaluate(() => g.boss.active), false);
    assert(await page.evaluate(() => g.player.position.x < 100));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: menu, boss direct start, no level waves, pause, arena respawn, game over/retry, victory/retry, campaign unchanged.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
