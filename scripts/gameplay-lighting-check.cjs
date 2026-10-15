const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),`${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`]}));
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('game.start();','window.g=game;game.start();')});});
  await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'COMENZAR',exact:true}).click();
  console.log('Level 1 section',await page.evaluate(async()=>{
   const {MachineGun}=await import('/src/weapons/MachineGun.ts');g.player.weapon=new MachineGun();g.loop.stop();
   const p=g.player;
   for(let i=0;i<1500&&p.position.x<820;i++){
    p.invulnerabilityTimer=10000;
    const ground=g.levelData.ground.find(b=>p.position.x>=b.x&&p.position.x<b.x+b.width);
    const gap=p.grounded&&ground&&ground.x+ground.width-p.position.x<22&&ground.x+ground.width<g.levelData.width;
    const obstacle=p.grounded&&g.level.solids.some(b=>b.x>p.position.x&&b.x-p.position.x<28&&b.y+b.height>p.position.y+2);
    g.input.setTouchAction('right',true);g.input.setTouchAction('shoot',true);g.input.setTouchAction('jump',!!(gap||obstacle));g.update(1/60);
   }
   g.input.clear();if(p.position.x<820||g.checkpoints.current.x<620)throw Error('Level 1 significant section failed');
   p.invulnerabilityTimer=0;g.playerView.update(p,0);g.render();return{x:p.position.x,checkpoint:g.checkpoints.current.name,kills:g.combat.kills};
  }));
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'iron-signal-phase212-level1.png')});
  await page.goto('http://127.0.0.1:5173/?mode=boss&level=levels/level-02.json&tuning');await page.waitForFunction(()=>window.g?.states.state==='PLAYING');await page.evaluate(()=>g.assets.preload());
  const source=await page.evaluate(()=>JSON.stringify(g.levelData));await page.keyboard.press('F3');
  for(const [id,value] of [['light-intensity','1.35'],['light-temporary','0.5']])await page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await page.locator('#light-full').check();assert.equal(await page.evaluate(()=>g.lighting.fullAmbient),true);
  assert.equal(await page.evaluate(()=>g.lighting.intensityMultiplier),1.35);assert.equal(await page.evaluate(()=>g.lighting.temporaryMultiplier),.5);
  await page.locator('#light-enabled').uncheck();assert.equal(await page.evaluate(()=>g.lighting.enabled),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(g.levelData)),source);
  await page.locator('#light-full').uncheck();await page.locator('#light-enabled').check();await page.locator('#quick-close').click();
  const physics=await page.evaluate(()=>{
   g.loop.stop();g.lighting.intensityMultiplier=g.lighting.temporaryMultiplier=1;
   const simulate=enabled=>{
    g.resetRun();g.lighting.enabled=enabled;g.player.invulnerabilityTimer=10000;
    for(let i=0;i<480;i++){g.input.setTouchAction('left',true);g.input.setTouchAction('shoot',true);g.input.setTouchAction('jump',i%90===0);g.update(1/60);}
    g.input.clear();return {player:{...g.player.position},velocity:{...g.player.velocity},health:g.player.health,boss:{...g.boss.position},bossHealth:g.boss.health,
     spawned:g.projectiles.totalSpawned,projectiles:g.projectiles.items.filter(p=>p.active).map(p=>({style:p.style,position:{...p.position},velocity:{...p.velocity},life:p.lifeRemaining,damage:p.damage}))};
   };
   const off=simulate(false),on=simulate(true);if(JSON.stringify(off)!==JSON.stringify(on))throw Error('Lighting changed chase gameplay');
   const missile=g.projectiles.items.find(p=>p.active&&p.style==='missile');if(!missile)throw Error('No live homing missile');
   const attached=g.lighting.attachedLights.find(s=>s.active&&s.source.position===missile.position);if(!attached)throw Error('Missile not attached');
   const before=g.fxSprites.spawnedCount;missile.lifeRemaining=.001;g.update(1/60);
   if(missile.active||g.lighting.attachedLights.some(s=>s.active&&s.source.position===missile.position))throw Error('Missile light residue');
   if(g.fxSprites.spawnedCount<=before||!g.lighting.temporaryCount)throw Error('Missile explosion did not illuminate');
   return {identicalGameplay:true,spawned:on.spawned,missileCleanup:true};
  });console.log('Chase',physics);
  await page.evaluate(()=>{g.player.invulnerabilityTimer=0;g.playerView.update(g.player,0);g.render();});
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'iron-signal-phase212-chase.png')});
  await page.goto('http://127.0.0.1:5173/?mode=boss&level=levels/level-03.json');await page.waitForFunction(()=>window.g?.states.state==='PLAYING');await page.evaluate(()=>g.assets.preload());
  console.log('Gate',await page.evaluate(()=>{
   g.loop.stop();g.player.invulnerabilityTimer=10000;g.input.clear();
   g.boss.turrets.forEach(t=>t.attackTimer=.001);g.update(1/60);
   if(!g.fxSprites.slots.some(s=>s.life>0&&s.id==='fx.muzzle.rifle'))throw Error('Gate turret muzzle missing');
   if(!g.lighting.temporaryCount)throw Error('Gate turret light missing');
   g.boss.turrets.forEach(t=>t.die());let hatchSeen=false;
   for(let i=0;i<150;i++){g.update(1/60);if(!hatchSeen&&g.lighting.attachedCount>0){g.player.invulnerabilityTimer=0;g.playerView.update(g.player,0);g.render();window.gatePreview=g.renderer.domElement.toDataURL();g.player.invulnerabilityTimer=10000;}hatchSeen ||=g.lighting.attachedCount>0;}
   if(!hatchSeen||!g.enemies.items.some(e=>e.bossOwned&&e.alive))throw Error('Hatch light/dog spawn failed');
   if(g.lighting.attachedCount>2)throw Error('Robot Dogs should not carry lights');
   g.boss.takeDamage(1);g.update(1/60);if(!g.lighting.slots.some(s=>s.active&&s.radius===24))throw Error('Boss damage light missing');
   const events=[],original=g.fxSprites.onSpawn;g.fxSprites.onSpawn=(id,x,y)=>{events.push(id);original?.(id,x,y);};
   g.projectiles.spawn(g.boss.position.x+5,g.boss.position.y+20,0,0,g.boss.health,'player');g.update(1/60);
   if(g.boss.alive)throw Error('Gate did not die immediately');
   for(let i=0;i<60;i++)g.update(1/60);
   const explosions=events.filter(id=>id.startsWith('fx.explosion.'));
   if(JSON.stringify(explosions)!==JSON.stringify(['fx.explosion.medium','fx.explosion.small','fx.explosion.small','fx.explosion.medium']))throw Error('Unbounded/wrong death sequence: '+JSON.stringify(explosions));
   if(g.lighting.attachedCount)throw Error('Dead hatch light residue');
   g.resetRun();for(let i=0;i<30;i++)g.update(1/60);
   if(events.filter(id=>id.startsWith('fx.explosion.')).length!==4)throw Error('Death sequence survived reset');
   return {hatchSeen,dogsHaveNoLight:true,deathExplosions:explosions.length};
  }));
  const gatePreview=await page.evaluate(()=>window.gatePreview);require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(),'iron-signal-phase212-gate.png'),Buffer.from(gatePreview.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);console.log('Gameplay lighting passed: dev-only comparison controls, unchanged chase physics, missile lifecycle, turret fire, hatches, damage, bounded death and reset.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
