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
      await route.fulfill({ response, body: (await response.text()).replace('game.start();', 'window.__game = game; game.start();') });
    });
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForFunction(() => window.__game?.states.state === 'MENU'); await page.keyboard.press('Enter');
    const keys = ['a','d','w','s','j'];
    const release = async () => { for (const key of keys) await page.keyboard.up(key); };
    const cases = [
      ['ground horizontal',true,['d'],1,0], ['ground up',true,['w'],0,1],
      ['ground diagonal',true,['w','d'],Math.SQRT1_2,Math.SQRT1_2], ['ground crouch',true,['s'],1,0],
      ['air horizontal',false,[],1,0], ['air up',false,['w'],0,1],
      ['air diagonal up',false,['w','d'],Math.SQRT1_2,Math.SQRT1_2],
      ['air down',false,['s'],0,-1], ['air down-right',false,['s','d'],Math.SQRT1_2,-Math.SQRT1_2],
      ['air down-left',false,['s','a'],-Math.SQRT1_2,-Math.SQRT1_2],
    ];
    for (const weapon of ['Rifle','MachineGun','SpreadGun','Laser']) {
      for (const [label,grounded,held,x,y] of cases) {
        await release();
        await page.evaluate(async ({weapon,grounded}) => {
          const g=__game, p=g.player, module=await import(`/src/weapons/${weapon}.ts`);
          g.projectiles.clear(); g.enemies.clear(); g.states.resume(); g.devPaused=false;
          p.weapon=new module[weapon](); p.position.x=62; p.position.y=grounded?44:170;
          p.velocity.x=p.velocity.y=0; p.height=26; p.direction=1; p.grounded=grounded;
          p.health=1; p.invulnerabilityTimer=30;
        },{weapon,grounded});
        for (const key of held) await page.keyboard.down(key);
        // Inspect aim with no FIRE, then the same live vector while firing.
        await page.waitForFunction(({x,y})=>Math.abs(__game.player.aimDirection.x-x)<1e-8 && Math.abs(__game.player.aimDirection.y-y)<1e-8,{x,y});
        assert.equal(await page.evaluate(()=>__game.projectiles.playerSpawned),0,label+' aim must not fire');
        const airborneUpper = !grounded && y > 0 ? `player.jumpShoot_${x === 0 ? 'up' : 'diagonal'}` : null;
        if (airborneUpper) {
          await page.waitForFunction(id=>__game.playerView.sprite.available && __game.playerView.sprite.assetId===id,airborneUpper);
          assert.deepEqual(await page.evaluate(id=>{
            const texture=__game.assets.getTexture(id);
            return [texture.image.width,texture.image.height,texture.magFilter,texture.minFilter];
          },airborneUpper),[128,64,1003,1003]);
        }
        await page.keyboard.down('j'); await page.waitForFunction(()=>__game.projectiles.playerSpawned>0);
        const shot=await page.evaluate(({x,y})=>{
          const g=__game; g.devPaused=true;
          const active=g.projectiles.items.filter(p=>p.active), speed=g.player.weapon.projectileSpeed;
          const central=active.find(p=>Math.abs(p.velocity.x/speed-x)<1e-8 && Math.abs(p.velocity.y/speed-y)<1e-8);
          return {velocity:central?{...central.velocity}:null,speed:g.player.weapon.projectileSpeed,crouching:g.player.crouching,assetId:g.playerView.sprite.assetId};
        },{x,y});
        assert.ok(shot.velocity,weapon+' '+label);
        assert.ok(Math.abs(shot.velocity.x/shot.speed-x)<1e-8 && Math.abs(shot.velocity.y/shot.speed-y)<1e-8,weapon+' '+label);
        if(label==='ground crouch') assert.equal(shot.crouching,true);
        if(airborneUpper) assert.equal(shot.assetId,airborneUpper);
      }
      await release();
      // The actual Game/CombatSystem damages an enemy below the Player. Only this QA
      // fixture freezes its AI so the shot-target alignment is deterministic.
      await page.evaluate(async weapon=>{
        const g=__game,p=g.player,module=await import(`/src/weapons/${weapon}.ts`);
        g.projectiles.clear(); g.enemies.clear(); p.weapon=new module[weapon]();
        p.position.x=62; p.position.y=145; p.velocity.x=p.velocity.y=0; p.height=26;p.direction=1;p.grounded=false;
        const enemy=g.enemies.spawn({kind:'soldier',x:74,y:44}); enemy.update=()=>{};
        window.__target=enemy; g.devPaused=false;
      },weapon);
      await page.keyboard.down('s'); await page.keyboard.down('j');
      await page.waitForFunction(()=>window.__target.health<window.__target.maxHealth);
      await page.evaluate(()=>{__game.devPaused=true;}); await release();
      console.log(weapon+': ground/air controls, no-fire aiming, normalized shots, crouch and enemy-below impact passed.');
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
