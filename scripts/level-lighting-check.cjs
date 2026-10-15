const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),`${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`]}));
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/src/devtools/level-editor-main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const editor = new LevelEditor();','const editor = new LevelEditor();window.editor=editor;')});});
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('game.start();','window.g=game;game.start();')});});
  await page.goto('http://127.0.0.1:5173/level-editor.html');await page.waitForFunction(()=>window.editor?.model.data.id==='level-01');
  assert.match(await page.locator('#validation').innerText(),/^0 errors/);
  assert.equal(await page.evaluate(()=>editor.lighting.staticLights.length),5);
  await page.click('[data-tool=light]');const box=await page.locator('#overlay').boundingBox();
  await page.mouse.click(box.x+243,box.y+box.height-183);
  await page.waitForFunction(()=>editor.model.data.lighting.lights.length===6);
  const id=await page.evaluate(()=>[...editor.model.selection][0]);
  assert.equal(await page.evaluate(id=>editor.model.data.lighting.lights.find(l=>l.id===id).x%16!==0,id),true);
  const prop=page.locator('#properties');
  for(const [name,value] of [['radius','90'],['intensity','0.85']]){await prop.getByLabel(name,{exact:true}).fill(value);await prop.getByLabel(name,{exact:true}).press('Tab');}
  await prop.getByLabel('behavior',{exact:true}).selectOption('pulse');
  await prop.getByLabel('speed',{exact:true}).fill('0.8');await prop.getByLabel('speed',{exact:true}).press('Tab');
  await prop.getByLabel('amount',{exact:true}).fill('0.25');await prop.getByLabel('amount',{exact:true}).press('Tab');
  await prop.getByLabel('color',{exact:true}).evaluate(e=>{e.value='#88bbdd';e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#lighting-properties').getByLabel('ambient',{exact:true}).fill('0.71');await page.locator('#lighting-properties').getByLabel('ambient',{exact:true}).press('Tab');
  const changed=await page.evaluate(id=>({...editor.model.data.lighting.lights.find(l=>l.id===id)}),id);
  assert.equal(changed.radius,90);assert.equal(changed.intensity,.85);assert.equal(changed.color,'#88bbdd');assert.equal(changed.behavior,'pulse');assert.equal(changed.speed,.8);assert.equal(changed.amount,.25);
  await page.click('[data-tool=select]');const center=await page.evaluate(id=>{const l=editor.model.data.lighting.lights.find(l=>l.id===id);return {x:(l.x-editor.pan.x)*editor.zoom,y:editor.overlay.height-(l.y-editor.pan.y)*editor.zoom};},id);
  await page.mouse.move(box.x+center.x,box.y+center.y);await page.mouse.down();await page.mouse.move(box.x+center.x+19,box.y+center.y-11);await page.mouse.up();
  const moved=await page.evaluate(id=>({...editor.model.data.lighting.lights.find(l=>l.id===id)}),id);assert.equal(moved.x-changed.x,9.5);assert.equal(moved.y-changed.y,5.5);
  await page.click('#duplicate');assert.equal(await page.evaluate(()=>editor.model.data.lighting.lights.length),7);
  await page.click('#delete');assert.equal(await page.evaluate(()=>editor.model.data.lighting.lights.length),6);
  await page.click('#undo');assert.equal(await page.evaluate(()=>editor.model.data.lighting.lights.length),7);
  await page.click('#redo');assert.equal(await page.evaluate(()=>editor.model.data.lighting.lights.length),6);
  await page.getByLabel('Show lights',{exact:true}).uncheck();assert.equal(await page.evaluate(()=>editor.lighting.enabled),true);
  await page.locator('#lighting-preview').uncheck();await page.locator('#lighting-preview').check();
  await page.locator('#lighting-properties').getByLabel('mode',{exact:true}).selectOption('quantized');assert.equal(await page.evaluate(()=>editor.lighting.quantization),4);
  await page.locator('#lighting-properties').getByLabel('mode',{exact:true}).selectOption('smooth');
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'iron-signal-light-editor.png')});
  const downloadPromise=page.waitForEvent('download');await page.click('#export');const download=await downloadPromise;
  const stream=await download.createReadStream();let bytes=[];for await(const b of stream)bytes.push(b);const text=Buffer.concat(bytes).toString('utf8');
  assert.deepEqual(JSON.parse(text).lighting,await page.evaluate(()=>editor.model.data.lighting));
  await page.setInputFiles('#file',{name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(text)});
  assert.deepEqual(await page.evaluate(()=>editor.model.data.lighting),JSON.parse(text).lighting);
  const expected=JSON.parse(text).lighting;await page.click('#play-here');await page.waitForFunction(()=>window.g?.states.state==='PLAYING');
  assert.deepEqual(await page.evaluate(()=>g.levelData.lighting),expected);assert.equal(await page.evaluate(()=>g.lighting.staticLights.length),6);assert.equal(await page.evaluate(()=>g.lighting.ambient),.71);
  assert.equal(await page.evaluate(()=>g.lighting.temporaryCount),0);
  await page.evaluate(()=>{g.loop.stop();g.lighting.enabled=false;g.lightingPanel.controls.get('enabled').checked=false;g.resetRun();if(!g.lighting.enabled||!g.lightingPanel.controls.get('enabled').checked)throw Error('Stale panel after restart');});
  // Refresh/runtime from authored JSONs uses the same config without the dev panel changing values.
  for(const [level,count,ambient] of [[1,5,.8],[2,6,.62],[3,10,.52]]){
   await page.goto(`http://127.0.0.1:5173/?level=levels/level-0${level}.json`);await page.getByRole('button',{name:'COMENZAR',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>g.lighting.staticLights.length),count);assert.equal(await page.evaluate(()=>g.lighting.ambient),ambient);
   await page.getByRole('button',{name:'COMENZAR',exact:true}).click();await page.evaluate(()=>{g.loop.stop();g.player.invulnerabilityTimer=0;g.update(1/60);g.render();});
   await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),`iron-signal-light-level${level}.png`)});
  }
  assert.deepEqual(errors,[]);console.log('Level lighting editor passed: LIGHT/free placement/move/properties/duplicate/delete/undo/redo/layers/preview/quantization/export/import/play-from-here and all authored levels.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
