const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
 `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('game.start();','window.g=game; game.start();')});});
  await page.goto('http://127.0.0.1:5173/?level=levels/level-03.json');
  await page.getByRole('button',{name:'COMENZAR',exact:true}).click();
  console.log(await page.evaluate(()=>{
   g.loop.stop();const p=g.player,modes=new Set(),dt=1/60;let jumps=0;
   // Protected traversal validates real movement/collision/jump limits, not combat difficulty.
   const step=(input={})=>{
    for(const action of ['left','right','up','down','shoot','jump'])g.input.setTouchAction(action,!!input[action]);
    if(p.alive)p.invulnerabilityTimer=30;
    const before=p.jumpCount;g.update(dt);jumps+=Math.max(0,p.jumpCount-before);modes.add(g.cameraController.mode);
    if(!p.alive&&g.states.state==='PLAYING')throw Error('Unexpected traversal death');
   };
   const walk=x=>{
    for(let n=0;n<1000&&Math.abs(p.position.x-x)>1&&g.states.state==='PLAYING';n++){
     const pit=p.position.y>500&&p.position.y<600&&p.position.x>834&&p.position.x<864&&p.grounded;
     step({left:p.position.x>x,right:p.position.x<x,jump:pit,shoot:true});
     if(!p.alive)throw Error('Fell during walk');
    }
    step();
   };
   const jump=(target,support)=>{
    const pre=target.x>p.position.x?Math.min(support.x+support.width-p.width-2,target.x+2):Math.max(support.x+2,target.x+target.width-p.width-2);
    walk(pre);const top=target.y+target.height;
    const dest=Math.max(target.x+2,Math.min(target.x+target.width-p.width-2,p.position.x));
    for(let n=0;n<100;n++){
     step({jump:n===0,left:p.position.x>dest+1,right:p.position.x<dest-1,shoot:true});
     if(n>2&&p.grounded&&Math.abs(p.position.y-top)<.5)return;
     if(!p.alive||p.position.y<support.y+support.height-40)throw Error(`Missed ${target.id}: ${p.position.x},${p.position.y}`);
    }
    throw Error(`Jump timeout ${target.id}: ${p.position.x},${p.position.y}`);
   };
   const retry=()=>{
    p.invulnerabilityTimer=0;p.takeDamage(p.health);g.update(dt);
    if(g.states.state!=='PLAYER_DEAD')throw Error('No death state');
    for(let n=0;n<40;n++)g.update(dt);
    if(!p.alive||g.states.state!=='PLAYING')throw Error('Respawn failed');
   };
   walk(418);let support=g.levelData.ground[0];
   for(const target of g.levelData.platforms.filter(p=>p.id.startsWith('first-step'))){jump(target,support);support=target;}
   if(p.position.y!==556)throw Error('First ascent incomplete');
   walk(1122);if(g.powerups.collectedCount<1)throw Error('No corridor power-up');
   support=g.levelData.ground.find(p=>p.id==='corridor-right');
   const main=g.levelData.platforms.filter(p=>p.id.startsWith('main-step'));
   for(const [index,target] of main.entries()){
    jump(target,support);support=target;
    if(index===13){retry();if(p.position.y!==1004||g.checkpoints.current.order!==3||g.cameraController.y<800)throw Error('Elevated checkpoint/camera failed');}
   }
   walk(1744);if(g.checkpoints.current.order!==4)throw Error('Pre-boss checkpoint missing');
   walk(1804);if(!g.boss.active||g.cameraController.mode!=='LOCKED')throw Error('Gate activation/lock failed');
   const gate=g.boss;
   // Destroy both independent turrets with real rifle trajectories (second from the high step).
   for(let n=0;n<1200&&gate.turrets[0].alive;n++)step({shoot:true});
   if(gate.turrets[0].alive)throw Error('Left turret could not be hit');
   const low=g.levelData.platforms.find(p=>p.id==='arena-step-low'),high=g.levelData.platforms.find(p=>p.id==='arena-step-high');
   jump(low,g.levelData.ground.find(p=>p.id==='upper-bridge'));jump(high,low);
   for(let n=0;n<1200&&gate.turrets[1].alive;n++)step({shoot:true});
   if(gate.turrets[1].alive)throw Error('Right turret could not be hit');
   g.spawnEnemy({kind:'robotDog',x:64,y:44}); // Unrelated dogs elsewhere must not consume the hatch cap.
   for(let n=0;n<180;n++)step();
   if(gate.phase!==2||!gate.vulnerable||!g.enemies.items.some(e=>e.bossOwned&&e.alive))throw Error('Hatches/dogs failed');
   if(g.enemies.items.filter(e=>e.bossOwned&&e.alive).length>3)throw Error('Dog limit exceeded');
   retry();
   if(gate.state!=='DORMANT'||gate.health!==gate.maxHealth||gate.turrets.some(t=>t.health!==t.maxHealth)||gate.hatches.some(h=>h.state!=='CLOSED')||g.enemies.items.some(e=>e.kind==='robotDog'))throw Error('Corrupt boss retry');
   walk(1804);
   // Repeat fixture shortens the already-validated turret section after proving reset.
   for(const part of gate.turrets)g.projectiles.spawn(part.position.x+2,part.position.y+18,0,0,part.health,'player');
   step();
   for(let n=0;n<4800&&gate.alive;n++)step({shoot:true});
   if(gate.alive||g.enemies.items.some(e=>e.bossOwned&&e.alive)||g.projectiles.activeCount)throw Error('Gate death cleanup failed');
   walk(2004);if(g.states.state!=='LEVEL_COMPLETE')throw Error('Exit did not complete level');
   if(!['HORIZONTAL_FOLLOW','VERTICAL_FOLLOW','LOCKED'].every(m=>modes.has(m)))throw Error('Camera modes missing');
   return {jumps,checkpoints:g.checkpoints.items.length,kills:g.combat.kills,modes:[...modes],state:g.states.state};
  }));
  await page.route('**/src/devtools/level-editor-main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const editor = new LevelEditor();','const editor = new LevelEditor();window.editor=editor;')});});
  await page.goto('http://127.0.0.1:5173/level-editor.html');
  await page.waitForFunction(()=>window.editor?.model.data.id==='level-01');
  await page.selectOption('#levels','level-03');await page.click('#load');
  await page.waitForFunction(()=>window.editor?.model.data.id==='level-03');
  assert.match(await page.locator('#validation').innerText(),/^0 errors/);
  await page.click('#overview');
  assert(await page.evaluate(()=>editor.zoom<1));
  const point=async(x,y)=>{const b=await page.locator('#overlay').boundingBox(),view=await page.evaluate(()=>({zoom:editor.zoom,pan:editor.pan}));return{x:b.x+(x-view.pan.x)*view.zoom,y:b.y+b.height-(y-view.pan.y)*view.zoom};};
  const drag=async(x,y,x2,y2)=>{const a=await point(x,y),b=await point(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.mouse.up();};
  await page.click('[data-tool="camera-zone"]');await drag(32,200,240,440);
  assert.equal(await page.evaluate(()=>editor.model.data.cameraZones.length),7);
  await page.locator('#properties').getByLabel('mode',{exact:true}).selectOption('HORIZONTAL_FOLLOW');
  await page.locator('#properties').getByLabel('transitionDuration',{exact:true}).fill('0.4');
  await page.locator('#properties').getByLabel('transitionDuration',{exact:true}).press('Tab');
  await page.click('#delete');assert.equal(await page.evaluate(()=>editor.model.data.cameraZones.length),6);
  await page.click('[data-tool="trigger"]');await drag(32,704,192,864);
  assert.equal(await page.locator('#properties').getByLabel('height',{exact:true}).inputValue(),'160');
  await page.click('[data-tool="enemy"]');await page.getByRole('button',{name:'robotDog.run',exact:true}).click();
  const dog=await point(64,736);await page.mouse.click(dog.x,dog.y);
  assert.equal(await page.evaluate(()=>editor.model.data.spawnGroups.at(-1).enemies[0].kind),'robotDog');
  await page.click('#undo');await page.click('#undo');
  assert.match(await page.locator('#validation').innerText(),/^0 errors/);
  await page.evaluate(()=>{editor.preview={x:1792,y:1328};});
  await page.click('#play-here');await page.waitForFunction(()=>window.g?.levelData.id==='level-03'&&g.states.state==='PLAYING');
  assert((await page.evaluate(()=>g.player.position.y))>1300);
  assert((await page.evaluate(()=>g.cameraController.y))>1200);
  assert.deepEqual(errors,[]);
  console.log('Level 3 passed: protected real traversal/jumps, XY camera modes, elevated respawn, pickups, independent turret shots, hatches/dog cap, boss retry/defeat/exit and high editor playtest.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
