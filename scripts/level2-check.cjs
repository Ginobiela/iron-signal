const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
  `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('game.start();', 'window.g=game; game.start();') });
    });
    await page.goto('http://127.0.0.1:5173/?level=levels/level-02.json');
    await page.waitForFunction(() => window.g?.states.state === 'MENU');
    const loaded = await page.evaluate(async () => {
      await g.assets.preload();
      const ids = Object.keys(g.assets.manifest).filter(id => id.includes('.underground.') || id.startsWith('boss.mecha.') || id === 'projectile.enemy.missile');
      for (const id of ids) {
        const texture = g.assets.getTexture(id), asset = g.assets.manifest[id];
        if (!texture || texture.image.width !== asset.sheet.frameWidth * asset.sheet.frameCount || texture.image.height !== asset.sheet.frameHeight)
          throw Error(`Missing or incorrectly sliced asset: ${id}`);
        if (texture.magFilter !== 1003 || texture.minFilter !== 1003) throw Error(`Smoothing enabled: ${id}`);
      }
      return ids.length;
    });
    assert.equal(loaded, 25);
    console.log('All 25 Level 2 PNGs loaded with matching source dimensions and NearestFilter.');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => g.states.state === 'PLAYING');
    console.log(await page.evaluate(() => {
      const step=()=>g.update(1/60), p=g.player;
      g.loop.stop();
      // Protect traversal fixture only: tests actual movement, gaps, combat and pickup collection, not balance.
      g.input.setTouchAction('right',true); g.input.setTouchAction('shoot',true);
      let jumped=false;
      for(let n=0;n<4000 && p.position.x<3670;n++) {
        p.invulnerabilityTimer=10;
        const edge=g.levelData.ground.find(b=>p.position.x>=b.x && p.position.x<b.x+b.width);
        const jump=p.grounded && edge && edge.x+edge.width-p.position.x<22 && edge.x+edge.width<g.levelData.width;
        g.input.setTouchAction('jump',!!jump); step(); jumped ||= p.jumpCount>0;
        if(!p.alive)throw Error('Traversal fell into a gap');
      }
      if(p.position.x<3670 || !jumped || g.powerups.collectedCount<1 || g.combat.kills<1)throw Error('Traversal/combat/pickup failed');
      const traversalPickups=g.powerups.collectedCount;
      g.input.setTouchAction('shoot',false);
      for(let n=0;n<90&&!g.boss.active;n++)step();
      if(!g.boss.active)throw Error('Boss trigger failed');
      g.input.setTouchAction('right',false); g.input.setTouchAction('left',true);
      for(let n=0;n<120;n++) { p.invulnerabilityTimer=10; step(); }
      if(g.boss.state!=='CHASE'||!g.projectiles.items.some(p=>p.style==='missile'))throw Error('Chase/missile failed');
      // Force a normal death, then exercise the real GameStateManager checkpoint timer and respawn.
      p.invulnerabilityTimer=0; p.takeDamage(p.health); step();
      if(g.states.state!=='PLAYER_DEAD')throw Error('Death did not enter state');
      for(let n=0;n<50;n++)step();
      if(!p.alive || g.states.state!=='PLAYING'||g.boss.state!=='DORMANT'||g.projectiles.activeCount)throw Error('Corrupt checkpoint retry');
      if(p.position.x<3590||p.position.x>3650)throw Error('Wrong checkpoint');
      g.input.clear(); g.input.setTouchAction('right',true);
      for(let n=0;n<100&&!g.boss.active;n++)step();
      if(!g.boss.active||g.boss.health!==g.boss.maxHealth)throw Error('Boss retry activation/HP failed');
      // Protected boss fixture retains default weapon damage/cadence and real projectiles/collisions.
      g.input.setTouchAction('right',false); g.input.setTouchAction('left',true); g.input.setTouchAction('shoot',true);
      const health=g.boss.health;
      for(let n=0;n<1900&&g.states.state==='PLAYING';n++) {
        p.invulnerabilityTimer=10;
        g.input.setTouchAction('jump',p.grounded && n%45===0);
        step();
      }
      if(g.boss.health>=health||g.boss.alive||g.states.state!=='LEVEL_COMPLETE')throw Error(`Boss defeat/extraction failed: ${g.boss.health}, ${g.states.state}, x=${p.position.x}`);
      if(g.projectiles.activeCount)throw Error('Attacks remain after completion');
      for(let n=0;n<60;n++)step();
      const corpse=g.bossView.sprite;
      if(!g.bossView.root.visible||!corpse.mesh.visible||!corpse.animator.completed||corpse.animator.frame!==5)
        throw Error('Mecha corpse did not retain the final death frame');
      if(corpse.mesh.material.color.getHex()!==0xffffff)throw Error('Corpse retained hit-flash tint');
      return {level:g.levelData.name,checkpoints:g.checkpoints.items.length,kills:g.combat.kills,traversalPickups,weapon:p.weapon.name,state:g.states.state};
    }));
    // Verify editor can load/edit the new encounter and export a valid round-trip document.
    await page.goto('http://127.0.0.1:5173/level-editor.html');
    await page.selectOption('#levels','level-02'); await page.click('#load');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#world-properties input')).some(input=>input.value==='level-02'));
    assert.match(await page.locator('#validation').innerText(), /^0 errors/);
    assert.deepEqual(errors, []);
    console.log('Level 2 integration passed: traversal, gaps, combat, pickups, trigger, pursuit, missiles, death/checkpoint retry, projectile boss kill, extraction, and editor loading.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
