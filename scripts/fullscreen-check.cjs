const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
 `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'COMENZAR',exact:true}).click();
  await page.keyboard.press('F11');
  await page.waitForFunction(()=>document.fullscreenElement?.id==='app');
  await page.waitForFunction(()=>Math.abs(document.querySelector('canvas').getBoundingClientRect().height-innerHeight)<1);
  let layout=await page.evaluate(()=>{
   const rect=document.querySelector('canvas').getBoundingClientRect();
   return {width:rect.width,height:rect.height,x:rect.x,y:rect.y,w:innerWidth,h:innerHeight,
    footer:getComputedStyle(document.querySelector('footer')).display,header:getComputedStyle(document.querySelector('header')).display,
    background:getComputedStyle(document.querySelector('#app')).backgroundColor,pressed:document.querySelector('#fullscreen-toggle').getAttribute('aria-pressed')};
  });
  assert.equal(layout.footer,'none'); assert.equal(layout.header,'none'); assert.equal(layout.background,'rgb(0, 0, 0)');
  assert.equal(layout.pressed,'true'); assert(Math.abs(layout.width/layout.height-256/240)<.001);
  assert(Math.abs(layout.y)<1); assert(Math.abs(layout.x-(layout.w-layout.width)/2)<1);
  await page.keyboard.press('F11'); await page.waitForFunction(()=>!document.fullscreenElement);
  assert.notEqual(await page.locator('footer').evaluate(node=>getComputedStyle(node).display),'none');
  await page.getByRole('button',{name:'PANTALLA COMPLETA · F11',exact:true}).click();
  await page.waitForFunction(()=>document.fullscreenElement?.id==='app');
  await page.evaluate(()=>document.exitFullscreen()); // Also verifies browser-controlled exits restore layout.
  await page.waitForFunction(()=>!document.fullscreenElement);
  assert.equal(await page.locator('#fullscreen-toggle').getAttribute('aria-pressed'),'false');
  assert.deepEqual(errors,[]);
  console.log('Fullscreen passed: F11 enter/exit, button entry, external exit, hidden header/footer, full-height aspect-preserving canvas and centered black side bars.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
