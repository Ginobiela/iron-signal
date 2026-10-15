const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
 `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.LIGHTING_URL||'http://127.0.0.1:5173/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('game.start();','window.g=game;game.start();')});});
  const open=async query=>{
   await page.goto(base+query);await page.waitForFunction(()=>window.g?.states.state==='MENU'||window.g?.states.state==='PLAYING');
   if(await page.evaluate(()=>g.states.state==='MENU'))await page.getByRole('button',{name:'COMENZAR',exact:true}).click();
   await page.evaluate(()=>{g.lightingPanel.controls.get('enabled').checked=true;g.lightingPanel.controls.get('debug').checked=false;g.lightingPanel.controls.get('warning').checked=true;g.lightingPanel.change();});
  };
  await open('?level=levels/level-03.json&lighting=lab');
  assert.equal(await page.evaluate(()=>g.onLevelComplete===undefined),true);
  assert.match(await page.evaluate(()=>g.levelData.name),/LIGHTING LAB/);
  await page.evaluate(()=>{
   const before=localStorage.getItem('iron-signal.highScore');g.score.add(999999);
   if(localStorage.getItem('iron-signal.highScore')!==before)throw Error('Lighting lab changed saved high score');
  });
  const graphics=await page.evaluate(()=>{
   g.loop.stop();g.lightingPanel.controls.get('warning').checked=false;g.lightingPanel.change();g.fxSprites.clear();
   const l=g.lighting,r=g.renderer,gl=r.getContext(),buf=new Uint8Array(512*480*4);
   const hash=()=>{gl.readPixels(0,0,512,480,gl.RGBA,gl.UNSIGNED_BYTE,buf);let h=2166136261;for(const v of buf)h=Math.imul(h^v,16777619);return h>>>0;};
   l.loadLevel();l.enabled=false;g.render();const off=hash();r.render(g.scene,g.camera);if(hash()!==off)throw Error('OFF differs from direct pipeline');
   l.enabled=true;l.setAmbient(0);g.render();hash();
   for(let i=0;i<buf.length;i+=4)if(buf[i]||buf[i+1]||buf[i+2])throw Error('Ambient darkness failed');
   l.addLight({x:120,y:100,radius:40,intensity:1,color:0xff0000});l.quantization=4;g.render();
   const lm=new Uint8Array(256*240*4);r.readRenderTargetPixels(l.targets.light,0,0,256,240,lm);
   const levels=[...new Set(Array.from({length:256*240},(_,i)=>lm[i*4]))].sort((a,b)=>a-b);
   if(JSON.stringify(levels)!=='[0,85,170,255]')throw Error('Quantization failed');
   l.enabled=false;g.render();if(hash()!==off)throw Error('OFF/ON/OFF residual darkness');
   l.enabled=true;l.quantization=0;l.clear();l.addLight({x:120,y:100,radius:20,intensity:1,color:0xffffff});
   const sample=()=>{g.render();const px=Math.floor((120-g.camera.position.x)/256*l.targets.light.width),py=Math.floor((100-g.camera.position.y)/240*l.targets.light.height),b=new Uint8Array(4);r.readRenderTargetPixels(l.targets.light,px,py,1,1,b);return [...b];};
   g.camera.position.set(0,0,10);const center=sample();g.camera.position.set(32,16,10);if(JSON.stringify(sample())!==JSON.stringify(center))throw Error('World-space drift');
   l.resolutionScale=1;g.render();if(l.targets.light.width!==512)throw Error('Full lightmap failed');l.resolutionScale=.5;g.render();
   const memory=JSON.stringify(r.info.memory);for(let i=0;i<120;i++)g.render();if(JSON.stringify(r.info.memory)!==memory)throw Error('GPU growth');
   return {offOnOff:true,levels,worldSpace:true,memory:JSON.parse(memory),targets:l.renderTargetCount};
  });console.log('Graphics',graphics);
  await page.setViewportSize({width:390,height:844});await page.locator('[name=enabled]').focus();await page.keyboard.press('F11');await page.waitForFunction(()=>!!document.fullscreenElement);
  assert.deepEqual(await page.evaluate(()=>[g.renderer.domElement.width,g.renderer.domElement.height]),[512,480]);
  await page.keyboard.press('F11');await page.waitForFunction(()=>!document.fullscreenElement);await page.setViewportSize({width:1100,height:900});
  // Real rAF gameplay, original balance; protection only prevents the fixture dying mid-sample.
  for(const level of [1,2,3]){
   await open(level===1?'':`?mode=boss&level=levels/level-0${level}.json`);
   await page.evaluate(async level=>{
    const {MachineGun}=await import('/src/weapons/MachineGun.ts');g.player.weapon=new MachineGun();g.player.invulnerabilityTimer=10000;
    if(level===1){g.player.position.x=2400;g.player.position.y=44;}
    g.input.setTouchAction('shoot',true);if(level===2)g.input.setTouchAction('left',true);
    window.samples=[];window.maxLights=0;window.maxAttached=0;window.maxVisible=0;window.maxTemporary=0;window.missilesSeen=false;window.dogsSeen=false;
    window.sampleTimer=setInterval(()=>{
     maxLights=Math.max(maxLights,g.lighting.activeCount);maxAttached=Math.max(maxAttached,g.lighting.attachedCount);maxVisible=Math.max(maxVisible,g.lighting.visibleCount);maxTemporary=Math.max(maxTemporary,g.lighting.temporaryCount);missilesSeen ||=g.projectiles.items.some(p=>p.active&&p.style==='missile');dogsSeen ||=g.enemies.items.some(e=>e.active&&e.alive&&e.kind==='robotDog');
     samples.push({fps:g.loop.fps,calls:g.lighting.drawCalls,textures:g.renderer.info.memory.textures,geometries:g.renderer.info.memory.geometries,lights:g.lighting.activeCount});
    },100);
    window.burstTimer=setInterval(()=>g.fxSprites.spawn('fx.explosion.small',g.player.position.x+30,g.player.position.y+20),350);
    if(level===3)window.phaseTimer=setTimeout(()=>{g.boss.turrets.forEach(t=>t.die());},1500);
   },level);
   await page.waitForTimeout(6000);
   const report=await page.evaluate(()=>{
    clearInterval(sampleTimer);clearInterval(burstTimer);clearTimeout(window.phaseTimer);g.input.clear();g.loop.stop();
    const selected=samples.slice(20),avg=key=>Math.round(selected.reduce((n,s)=>n+s[key],0)/selected.length);
    return {fps:avg('fps'),drawCalls:avg('calls'),textures:Math.max(...selected.map(s=>s.textures)),geometries:Math.max(...selected.map(s=>s.geometries)),maxLights,maxAttached,maxVisible,maxTemporary,missilesSeen,dogsSeen,boss:g.boss.state};
   });
   if(level===2){assert.equal(report.missilesSeen,true);assert.ok(report.maxAttached>=1);}if(level===3){assert.equal(report.dogsSeen,true);assert.ok(report.maxAttached>=1);}
   assert.ok(report.maxLights>=2);console.log(`Level ${level} gameplay`,report);
   // Actual death and checkpoint respawn, then clean restart. The diagnostic light is intentionally disabled here.
   await page.evaluate(()=>{
    g.lightingPanel.controls.get('warning').checked=false;g.lightingPanel.change();
    if(g.levelData.id==='level-03'){g.player.position.x=1232;g.player.position.y=1004;g.update(1/60);}
    g.player.invulnerabilityTimer=0;g.player.takeDamage(g.player.health);g.update(1/60);
    if(g.states.state!=='PLAYER_DEAD')throw Error('Death failed');
    for(let i=0;i<60;i++)g.update(1/60);
    if(g.states.state!=='PLAYING'||g.lighting.temporaryCount)throw Error('Respawn light residue');
    g.lighting.onVfx('fx.explosion.medium',g.player.position.x,g.player.position.y);g.resetRun();
    if(g.lighting.attachedCount||g.lighting.temporaryCount||g.lighting.staticLights.length!==g.levelData.lighting.lights.length)throw Error('Restart light residue');
   });
  }
  // Reuse the existing campaign/editor/level workflows in sequence, enabling lighting in their own fixtures.
  for(const file of ['campaign-respawn-check.cjs','level2-check.cjs','level3-check.cjs']){
   let code=fs.readFileSync(path.join(__dirname,file),'utf8');
   code=code.replaceAll('window.g=game; game.start();','window.g=game; game.start();game.lighting.enabled=true;game.lightingPanel.controls.get("enabled").checked=true;game.lightingPanel.controls.get("debug").checked=false;');
   if(file==='campaign-respawn-check.cjs'){
    code=code.replace('assert.equal(next.previousStopped,true);assert.equal(next.previousScene,0);',
      "assert.equal(next.previousStopped,true);assert.equal(next.previousScene,0);assert.equal(await page.evaluate(()=>previousGame.lighting.activeCount),0);assert.equal(await page.locator('section').filter({hasText:'DYNAMIC LIGHTING'}).count(),1);");
    code=code.replace('g.boss.die();g.update(1/60);', "window.previousSecondGame=g;g.lighting.onVfx('fx.explosion.medium',g.player.position.x,g.player.position.y);g.boss.die();g.update(1/60);");
    code=code.replace("assert.equal(new URL(page.url()).searchParams.get('level'),'levels/level-03.json');",
      "assert.equal(new URL(page.url()).searchParams.get('level'),'levels/level-03.json');assert.equal(await page.evaluate(()=>previousSecondGame.lighting.activeCount),0);assert.equal(await page.locator('section').filter({hasText:'DYNAMIC LIGHTING'}).count(),1);");
   }
   code=code.replace(/\(async\s*\(\)\s*=>\s*\{/,'return (async()=>{');
   await new Function('require','__dirname',code)(require,__dirname);
  }
  if(process.argv.includes('--soak')){
   await open('?level=levels/level-03.json&lighting=lab');
   await page.evaluate(()=>g.lightingPanel.startTest('soak'));console.log('Starting existing 180-second soak (lights only, frozen gameplay).');
   for(let i=0;i<6;i++){await page.waitForTimeout(30500);console.log('Soak progress',Math.min(180,(i+1)*30));}
   const rows=await page.evaluate(()=>JSON.parse(g.lightingPanel.report.textContent));
   const stable=rows.slice(1);for(const key of ['textures','geometries','programs'])assert.equal(new Set(stable.map(r=>r[key])).size,1,key+' grew');
   assert.equal(rows.at(-1).activeAfterExpiry,0);console.log('Soak',JSON.stringify({first:rows[0],last:rows.at(-1)}));
  }
  await page.evaluate(()=>g.dispose());assert.equal(await page.locator('section').filter({hasText:'DYNAMIC LIGHTING'}).count(),0);
  assert.deepEqual(errors,[]);console.log('Lighting closure checks passed; no shader/runtime errors. Static, temporary and attached lights validated.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
