const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),`${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`]}));
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/main.ts',r=>r.fulfill({contentType:'text/javascript',body:`import './style.css';import {Game} from './core/Game';window.g=new Game(document.querySelector('#viewport'),document.querySelector('#debug'),document.querySelector('#combat-status'),document.querySelector('#powerup-notice'),document.querySelector('#game-menu'),document.querySelector('#boss-status'));await g.assets.preload();g.start();`}));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.g?.states.state==='MENU');
 assert(await page.locator('#touch-controls').isVisible());await page.locator('[data-actions="start"]').tap();await page.waitForFunction(()=>g.states.state==='PLAYING');await page.evaluate(()=>g.player.invulnerabilityTimer=1000);
 const cdp=await page.context().newCDPSession(page);const point=async(action,id)=>{const b=await page.locator(`[data-actions="${action}"]`).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2,id}};
 const diagonal=await point('right up',1),shoot=await point('shoot',2),jump=await point('jump',3);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[diagonal,shoot]});
 await page.waitForFunction(()=>g.input.isDown('right')&&g.input.isDown('up')&&g.input.isDown('shoot')&&g.player.velocity.x>0&&g.player.aimDirection.y>0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[diagonal,shoot,jump]});await page.waitForFunction(()=>g.player.velocity.y>0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForFunction(()=>!g.input.isDown('right')&&!g.input.isDown('shoot')&&!g.input.isDown('jump'));
 const right=await point('right',4),left=await point('left',4);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[left]});await page.waitForFunction(()=>g.input.isDown('left')&&!g.input.isDown('right'));
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>g.input.isDown('left')),false);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.locator('[data-actions="pause"]').tap();await page.waitForFunction(()=>g.states.state==='PAUSED');await page.locator('[data-actions="start"]').tap();await page.waitForFunction(()=>g.states.state==='PLAYING');
 for(const size of [{width:320,height:568},{width:844,height:390}]){await page.setViewportSize(size);assert(await page.locator('[data-actions="jump"]').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const b=await page.locator('#viewport canvas').boundingBox();assert(Math.abs(b.width/b.height-256/240)<0.01);}
 assert.deepEqual(errors,[]);await page.evaluate(()=>g.dispose());console.log('Mobile controls passed: START/PAUSE, diagonal + fire + jump multitouch, slide, cancel, blur, portrait/landscape and canvas aspect.');
 const desktop=await browser.newPage();await desktop.goto('http://127.0.0.1:5173/');assert.equal(await desktop.locator('#touch-controls').isVisible(),false);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
