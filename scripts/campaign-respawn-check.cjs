const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
 `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage(), errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('game.start();','window.g=game; game.start();')});
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'COMENZAR',exact:true}).click();
  await page.evaluate(()=>{
   g.loop.stop(); g.player.position.x=2400;g.player.position.y=44;g.player.invulnerabilityTimer=1000;
   g.update(1/60); if(g.checkpoints.current.x!==2400)throw Error('Checkpoint not reached');
   for(let retry=0;retry<2;retry++) {
    const old=[...g.enemies.items]; for(const enemy of old)enemy.die();
    g.player.invulnerabilityTimer=0; g.player.takeDamage(g.player.health); g.update(1/60);
    if(g.states.state!=='PLAYER_DEAD')throw Error('No death state');
    for(let n=0;n<40;n++)g.update(1/60);
    if(g.states.state!=='PLAYING'||g.checkpoints.current.x!==2400)throw Error('Wrong checkpoint retry');
    if(!g.enemies.items.length||g.enemies.items.some(e=>old.includes(e)))throw Error('Enemies were not recreated');
    if(g.enemies.items.some(e=>!e.alive||e.health!==e.maxHealth))throw Error('Enemies missing health');
    if(g.enemyViews.length!==g.enemies.items.length)throw Error('Leaked views or duplicate enemies');
    const expected=g.levelData.spawnGroups.filter(group=>group.x<=g.cameraController.x).flatMap(group=>group.enemies).filter(e=>e.x>=g.cameraController.x);
    if(expected.length!==g.enemies.items.length)throw Error('Wrong checkpoint waves');
    if(g.projectiles.activeCount||g.powerups.activeCount)throw Error('Stale attacks/pickups');
   }
  });
  await page.keyboard.press('F11'); await page.waitForFunction(()=>document.fullscreenElement?.id==='app');
  const progress=await page.evaluate(async()=>{
   const {MachineGun}=await import('/src/weapons/MachineGun.ts');
   g.player.weapon=new MachineGun();g.score.add(1234);g.player.position.x=g.boss.arenaLeft;g.player.position.y=44;
   g.player.grounded=true;g.player.invulnerabilityTimer=100;g.boss.activate(g.boss.arenaLeft);
   g.boss.state='RECOVER';g.boss.attackTimer=10;g.projectiles.clear();
   window.previousGame=g;
   const lives=g.states.lives;
   g.projectiles.spawn(g.boss.position.x+10,g.boss.position.y+20,0,0,g.boss.maxHealth,'player');
   g.update(1/60);
   if(g.boss.alive)throw Error('Boss not killed through combat');
   return {lives,score:g.score.value,weapon:g.player.weapon.name};
  });
  await page.waitForFunction(()=>g!==previousGame&&g.levelData.name==='Nexo Subterráneo'&&g.states.state==='PLAYING');
  const next=await page.evaluate(()=>({lives:g.states.lives,score:g.score.value,weapon:g.player.weapon.name,
   checkpoint:g.checkpoints.current.x,fullscreen:document.fullscreenElement?.id,canvases:document.querySelectorAll('#viewport canvas').length,
   previousStopped:!previousGame.loop.running,previousScene:previousGame.scene.children.length}));
  assert.equal(next.lives,progress.lives);assert.equal(next.score,progress.score);assert.equal(next.weapon,progress.weapon);
  assert.equal(next.checkpoint,48);assert.equal(next.fullscreen,'app');assert.equal(next.canvases,1);
  assert.equal(next.previousStopped,true);assert.equal(next.previousScene,0);
  assert.equal(new URL(page.url()).searchParams.get('level'),'levels/level-02.json');
  await page.evaluate(()=>{g.loop.stop();g.player.position.x=g.levelData.exitX;g.player.position.y=44;
   g.player.grounded=true;g.boss.die();g.update(1/60);});
  assert.equal(await page.evaluate(()=>g.states.state),'LEVEL_COMPLETE');
  await page.goto('http://127.0.0.1:5173/?mode=boss');
  await page.waitForFunction(()=>window.g?.boss.active&&g.states.state==='PLAYING');
  await page.evaluate(()=>{g.loop.stop();g.boss.state='RECOVER';g.boss.attackTimer=10;g.player.invulnerabilityTimer=100;
    g.projectiles.spawn(g.boss.position.x+10,g.boss.position.y+20,0,0,g.boss.maxHealth,'player');g.update(1/60);});
  await page.waitForFunction(()=>g.levelData.name==='Nexo Subterráneo'&&g.states.state==='PLAYING');
  assert.equal(new URL(page.url()).searchParams.has('mode'),false);
  assert((await page.evaluate(()=>g.player.position.x))<100);assert.equal(await page.evaluate(()=>g.boss.active),false);
  assert.deepEqual(errors,[]);
  console.log('Campaign/respawn passed: checkpoint retries recreate enemies at full HP without duplicates; first boss kill starts Level 2 preserving lives, score, weapon/fullscreen; Boss Run also advances to the normal Level 2 spawn, and Level 2 completes normally.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
