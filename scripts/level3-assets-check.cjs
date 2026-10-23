const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))missing.push(r.url());});
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('game.start();','window.g=game;game.start();')});});
  await page.goto('http://127.0.0.1:5173/?level=levels/level-03.json');
  await page.getByRole('button',{name:'COMENZAR',exact:true}).click();
  const report=await page.evaluate(async()=>{
   const {NearestFilter}=await import('/node_modules/three/build/three.module.js');
   const {SpriteVisual}=await import('/src/rendering/SpriteVisual.ts');
   g.loop.stop();g.player.invulnerabilityTimer=0;
   const entries=Object.entries(g.assets.manifest).filter(([id,asset])=>!asset.internal&&(id.includes('.tower.')||/^(robotDog|bossGate|bossGateTurret|bossGateHatch)\./.test(id)));
   for(const [id,asset] of entries){
    const texture=g.assets.getTexture(id);if(!texture)throw Error(`Missing texture ${id}`);
    if(texture.image.width!==asset.sheet.frameWidth*asset.sheet.frameCount||texture.image.height!==asset.sheet.frameHeight)throw Error(`Dimensions ${id}`);
    if(texture.magFilter!==NearestFilter||texture.minFilter!==NearestFilter)throw Error(`Filter ${id}`);
    const preview=new SpriteVisual(g.assets,asset.visual);
    if(!preview.update(id,0)||preview.assetId!==id)throw Error(`Fallback ${id}`);
    for(let frame=0;frame<asset.sheet.frameCount;frame++)preview.update(id,1/(asset.clip.frameRate||1));
    preview.update(id,0,true);if(preview.mesh.scale.x>=0)throw Error(`Flip ${id}`);
    preview.dispose();
   }
   g.update(1/60);g.render();
   return {count:entries.length,textures:g.renderer.info.memory.textures,drawCalls:g.renderer.info.render.calls};
  });
  assert.equal(report.count,31);
  const path=require('node:path'),os=require('node:os');
  await page.screenshot({path:path.join(os.tmpdir(),'iron-signal-level3-art-entry.png')});
  await page.evaluate(()=>{
   Object.assign(g.player.position,{x:1810,y:1356});Object.assign(g.player.velocity,{x:0,y:0});g.player.grounded=true;
   g.cameraController.reset(g.player.position.x,g.player.position.y+16);g.update(1/60);g.render();
   if(!g.bossView.sprite.available)throw Error('Gate fallback');
   if(g.bossView.componentViews.some(v=>!v.sprite.available||v.gun.visible))throw Error('Turret fallback / duplicate gun');
   if(g.bossView.hatchVisuals.some(v=>!v.sprite.available))throw Error('Hatch fallback');
  });
  await page.screenshot({path:path.join(os.tmpdir(),'iron-signal-level3-art-gate.png')});
  assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
  console.log('Level 3 art passed:',JSON.stringify(report),'31 loaded textures/strips, nearest filtering, frame traversal, flip, boss components and no asset errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
