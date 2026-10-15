const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),`${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`]}));
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/src/devtools/level-editor-main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const editor = new LevelEditor();','const editor = new LevelEditor();window.editor=editor;')});});
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replaceAll('game.start();','window.g=game;game.start();')});});
  await page.goto('http://127.0.0.1:5173/level-editor.html');await page.waitForFunction(()=>window.editor?.model.data.id==='level-01');
  await page.selectOption('#levels','level-03');await page.click('#load');await page.waitForFunction(()=>editor.model.data.id==='level-03');
  const world=async(x,y)=>page.evaluate(({x,y})=>{const b=editor.overlay.getBoundingClientRect();return{x:b.x+(x-editor.pan.x)*editor.zoom,y:b.y+b.height-(y-editor.pan.y)*editor.zoom};},{x,y});
  await page.click('[data-tool=enemy]');
  await page.getByLabel('Place in trigger',{exact:true}).selectOption(await page.evaluate(()=>editor.model.data.spawnGroups[0].id));
  for(const [i,kind]of ['mecha','gateTurret','gateHatch'].entries()){
   await page.locator('#palette').getByRole('button',{name:kind+'.idle',exact:true}).click();
   const p=await world(160+i*96,48);await page.mouse.click(p.x,p.y);
  }
  assert.deepEqual(await page.evaluate(()=>editor.model.data.spawnGroups[0].enemies.slice(-3).map(e=>e.kind)),['mecha','gateTurret','gateHatch']);
  await page.click('[data-tool=select]');
  const turretId=await page.evaluate(()=>{
   const ref=editor.model.objects().find(o=>o.type==='bossPart'&&o.value.part==='turrets'&&o.value.index===0);
   editor.pan={x:editor.model.data.boss.x-200,y:editor.model.data.boss.y-80};editor.resize();return ref.id;
  });
  const partCenter=async()=>page.evaluate(id=>{const ref=editor.model.objects().find(o=>o.id===id),b=editor.bounds(ref),r=editor.overlay.getBoundingClientRect();return{x:r.x+(b.x+b.width/2-editor.pan.x)*editor.zoom,y:r.y+r.height-(b.y+b.height/2-editor.pan.y)*editor.zoom};},turretId);
  let p=await partCenter();await page.mouse.click(p.x,p.y);
  assert.match(await page.locator('#properties').innerText(),/BOSSPART/);
  await page.locator('#properties').getByLabel('x',{exact:true}).fill('-56');await page.locator('#properties').getByLabel('x',{exact:true}).press('Tab');
  p=await partCenter();await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+32,p.y-32);await page.mouse.up();
  assert.deepEqual(await page.evaluate(()=>editor.model.data.boss.gateLayout.turrets[0]),{x:-40,y:18});
  await page.click('#undo');assert.equal(await page.evaluate(()=>editor.model.data.boss.gateLayout.turrets[0].x),-56);
  await page.click('#redo');
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'iron-signal-gate-editor-components.png')});
  const gateData=await page.evaluate(async()=>{const {exportLevel}=await import('/src/level/LevelDocument.ts');return JSON.parse(exportLevel(editor.model.data));});
  await page.selectOption('#levels','level-02');await page.click('#load');await page.waitForFunction(()=>editor.model.data.id==='level-02');
  const before=await page.evaluate(()=>structuredClone(editor.model.data.boss));
  await page.evaluate(()=>{editor.pan={x:editor.model.data.boss.x-200,y:editor.model.data.boss.y-20};editor.resize();});
  p=await world(before.x+28,before.y+36);await page.mouse.click(p.x,p.y);
  assert.match(await page.locator('#properties').innerText(),/BOSSSPAWN/);
  await page.locator('#properties').getByLabel('x',{exact:true}).fill(String(before.x+12));await page.locator('#properties').getByLabel('x',{exact:true}).press('Tab');
  assert.equal(await page.evaluate(()=>editor.model.data.boss.x),before.x+12);
  assert.deepEqual(await page.evaluate(()=>editor.model.data.boss.encounter),before.encounter);
  assert.equal(await page.evaluate(()=>editor.model.data.boss.arenaLeft),before.arenaLeft);
  // Import the edited gate level via the actual file control; playtest its unexported settings.
  await page.locator('#file').setInputFiles({name:'mini-boss-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(gateData))});
  await page.waitForFunction(()=>editor.model.data.id==='level-03');assert.match(await page.locator('#validation').innerText(),/^0 errors/);
  await page.click('#play');await page.waitForFunction(()=>window.g?.states.state==='PLAYING');
  console.log(await page.evaluate(async()=>{
   g.loop.stop();await g.assets.preload();
   for(const action of ['left','right','up','down','shoot','jump'])g.input.setTouchAction(action,false);
   g.player.invulnerabilityTimer=1000;
   for(let i=0;i<240;i++){g.input.setTouchAction('right',i<120);g.update(1/60);}g.input.clear();
   const minis=g.enemies.items.filter(e=>['mecha','gateTurret','gateHatch'].includes(e.kind));
   if(minis.length!==3||!g.enemies.items.some(e=>e.kind==='robotDog')||!minis.some(e=>e.kind==='mecha'&&e.visualFireCount>0))throw Error('Missing runtime mini-boss integration: '+JSON.stringify({minis:minis.map(e=>[e.kind,e.active,e.health,e.position,e.visualFireCount]),dogs:g.enemies.items.filter(e=>e.kind==='robotDog').length,state:g.states.state}));
   for(const enemy of minis){const view=g.enemyViews.find(v=>v.entity===enemy);if(!view?.sprite.available)throw Error('Missing sprite: '+enemy.kind);}
   if(g.boss.state!=='DORMANT')throw Error('Mini-boss accidentally activated final boss');
   const layout=JSON.stringify(g.levelData.boss.gateLayout);minis.find(e=>e.kind==='mecha').health=1;g.respawn();
   if(JSON.stringify(g.levelData.boss.gateLayout)!==layout)throw Error('Layout lost on respawn');
   if(g.enemies.items.some(e=>e.kind==='robotDog'))throw Error('Residual dogs after respawn');
   for(let i=0;i<120;i++){g.player.invulnerabilityTimer=1000;g.input.setTouchAction('right',true);g.update(1/60);}g.input.clear();
   if(g.enemies.items.filter(e=>['mecha','gateTurret','gateHatch'].includes(e.kind)).length!==3)throw Error('Mini-bosses not respawned');
   for(const enemy of g.enemies.items)if(['mecha','gateTurret','gateHatch'].includes(enemy.kind)&&enemy.health!==enemy.maxHealth)throw Error('Corrupt mini-boss reset');
   return{miniBosses:minis.map(e=>e.kind),sprites:true,missiles:true,dogs:true,respawn:true};
  }));
  assert.deepEqual(errors,[]);console.log('Editor/runtime passed: palette, component drag, offsets, undo/redo, independent mecha spawn, import and playtest.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
