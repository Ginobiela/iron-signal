const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
  `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ channel:'chrome',headless:true });
 try {
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.testPad={id:'Xbox aim-lock fixture',mapping:'standard',connected:true,axes:[0,0],
    buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[testPad]});
  });
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch(); await route.fulfill({response,body:(await response.text()).replace('game.start();','window.g=game; game.start();')});
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>window.g?.states.state==='MENU');
  await page.evaluate(()=>g.assets.preload()); await page.keyboard.press('Enter');
  await page.waitForFunction(()=>g.states.state==='PLAYING');
  await page.evaluate(()=>{
   g.loop.stop(); const platform=g.level.oneWays[0];
   g.player.reset(platform.x+16,platform.y+platform.height); g.player.invulnerabilityTimer=1000;
   for(let i=0;i<10;i++)g.update(1/60);
   if(!g.player.onOneWay)throw Error('Platform fixture not grounded');
  });
  const initial=await page.evaluate(()=>({...g.player.position}));
  await page.keyboard.down('k'); await page.keyboard.down('s'); await page.keyboard.down('d');
  let state=await page.evaluate(()=>{for(let i=0;i<60;i++)g.update(1/60);return {position:{...g.player.position},grounded:g.player.grounded,crouching:g.player.crouching,aim:{...g.player.aimDirection},shots:g.projectiles.playerSpawned,clip:g.playerView.sprite.assetId};});
  assert.deepEqual(state.position,initial); assert.equal(state.grounded,true); assert.equal(state.crouching,false);
  assert.deepEqual(state.aim,{x:Math.SQRT1_2,y:-Math.SQRT1_2}); assert.equal(state.shots,0);
  assert.equal(state.clip,'player.aim_diagonalDown');
  await page.keyboard.down('j');
  state=await page.evaluate(()=>{for(let i=0;i<30;i++)g.update(1/60);return {position:{...g.player.position},shots:g.projectiles.playerSpawned,clip:g.playerView.sprite.assetId};});
  assert.deepEqual(state.position,initial); assert(state.shots>0); assert.equal(state.clip,'player.jumpShoot_diagonalDown');
  await page.keyboard.up('j'); await page.keyboard.up('d'); await page.keyboard.up('k');
  await page.evaluate(()=>g.update(1/60)); assert.equal(await page.evaluate(()=>g.player.crouching),true);
  await page.keyboard.up('s');
  // LT hold + stick diagonal aims in place; RT remains the independent fire trigger.
  await page.evaluate(()=>{testPad.axes=[-.8,.8];testPad.buttons[6].value=.8;for(let i=0;i<30;i++)g.update(1/60);});
  assert.deepEqual(await page.evaluate(()=>({...g.player.position})),initial);
  assert.deepEqual(await page.evaluate(()=>({...g.player.aimDirection})),{x:-Math.SQRT1_2,y:-Math.SQRT1_2});
  await page.evaluate(()=>{testPad.axes=[0,.8];testPad.buttons[7].value=.8;for(let i=0;i<30;i++)g.update(1/60);});
  assert.deepEqual(await page.evaluate(()=>({...g.player.aimDirection})),{x:0,y:-1});
  assert.equal(await page.evaluate(()=>g.playerView.sprite.assetId),'player.jumpShoot_down');
  await page.evaluate(()=>{testPad.buttons[6].value=0;testPad.buttons[7].value=0;testPad.axes=[.8,0];g.update(1/60);});
  assert((await page.evaluate(()=>g.player.position.x))>initial.x);
  assert.deepEqual(errors,[]);
  console.log('Aim lock passed: K/LT, grounded platform lower aim without fire, both lower diagonals, J/RT fire and real sprites, release restores crouch/movement.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
