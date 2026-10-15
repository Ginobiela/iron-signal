import { Vector3 } from 'three';
import type { OrthographicCamera, WebGLRenderer } from 'three';
import type { LightingSystem, LightSlot } from '../rendering/LightingSystem';
import type { VfxId } from '../config/vfx';

/** Disposable DEV-only controls. No LevelData schema or gameplay tuning changes. */
export class LightingPanel {
  private readonly root=document.createElement('section');
  private readonly point=new Vector3();
  private mouseX=0; private mouseY=0;
  private debugLight?:LightSlot; private warningLight?:LightSlot;
  private debugGeneration=0; private warningGeneration=0;
  private last=0; private elapsed=0; private frames=0;
  private readonly stats:HTMLOutputElement;
  private readonly controls=new Map<string,HTMLInputElement>();
  private restore?:()=>void;
  private manualRestore?:()=>void;
  private cameraX=0; private cameraY=0;
  private run?:{kind:'benchmark'|'soak';phase:number;frame:number;start:number;last:number;sum:number;cpu:number;calls:number;rows:object[];memory:object[]};
  private readonly counts=[-1,0,1,4,8,16,32];
  private readonly report:HTMLPreElement;
  private benchmarkCamera?:OrthographicCamera;
  constructor(private readonly lighting:LightingSystem,private readonly renderer:WebGLRenderer,
    private readonly warning:{x:number;y:number},private readonly freeze:()=>()=>void,
    private readonly effect:(id:VfxId)=>void){
    this.root.style.cssText='position:fixed;right:8px;top:8px;width:255px;max-height:95vh;overflow:auto;background:#101923ee;color:#eee;padding:12px;z-index:9999;font:12px monospace;border:1px solid #75899a';
    this.root.innerHTML=`<strong>DYNAMIC LIGHTING · F6</strong>
      <label style="display:block"><input name="enabled" type="checkbox"> Enabled</label>
      <label style="display:block"><input name="fullAmbient" type="checkbox"> FULL AMBIENT comparison</label>
      <label>Ambient <input name="ambient" type="range" min="0" max="1" step=".01" value=".35"></label>
      <label>Light Mode <select name="mode"><option value="0">Smooth</option><option value="1">Quantized</option></select></label>
      <label>Quantization <select name="levels"><option>2</option><option>3</option><option selected>4</option><option>5</option></select></label>
      <label>Lightmap <select name="resolution"><option value=".5">256×240</option><option value="1">512×480</option></select></label>
      <label style="display:block"><input name="debug" type="checkbox"> Debug Light</label>
      <label>Follow <select name="follow"><option>Player</option><option>Mouse</option></select></label>
      <label>Color <select name="color"><option value="16777215">White</option><option value="16719904">Red</option><option value="16757344">Warm</option></select></label>
      <label>Debug radius <input name="radius" type="range" min="8" max="160" value="64"></label>
      <label style="display:block"><input name="warning" type="checkbox"> Fixed red warning (DEV)</label>
      <label style="display:block"><input name="bounds" type="checkbox"> Show light bounds</label>
      <label style="display:block"><input name="freeze" type="checkbox"> Freeze scene for comparison</label>
      <label>Camera probe X <input name="cameraX" type="range" min="-96" max="96" value="0"></label>
      <label>Camera probe Y <input name="cameraY" type="range" min="-96" max="96" value="0"></label>
      <div><button data-test="muzzle">Muzzle test</button><button data-test="explosion">Explosion test</button></div>
      <div><button data-test="benchmark">Benchmark temporary 0–32</button><button data-test="soak">Soak 3 min</button><button data-test="stop">Stop test</button></div>
      <output style="display:block;white-space:pre-wrap;margin-top:8px"></output>
      <pre aria-label="Lighting test results" style="white-space:pre-wrap"></pre>`;
    this.stats=this.root.querySelector('output')!;
    this.report=this.root.querySelector('pre')!;
    for(const element of this.root.querySelectorAll<HTMLInputElement>('[name]'))this.controls.set(element.name,element);
    this.syncFromLighting();
    this.root.querySelector('[data-test="muzzle"]')!.addEventListener('click',()=>this.effect('fx.muzzle.machineGun'));
    this.root.querySelector('[data-test="explosion"]')!.addEventListener('click',()=>this.effect('fx.explosion.medium'));
    this.root.querySelector('[data-test="benchmark"]')!.addEventListener('click',()=>this.startTest('benchmark'));
    this.root.querySelector('[data-test="soak"]')!.addEventListener('click',()=>this.startTest('soak'));
    this.root.querySelector('[data-test="stop"]')!.addEventListener('click',()=>this.stopTest());
    this.root.hidden=!new URLSearchParams(location.search).has('lighting');
    this.root.addEventListener('input',this.change);
    // Controls must not fire weapons or move the player while editing.
    this.root.addEventListener('keydown',this.stopKeys);
    document.querySelector('#app')!.append(this.root);
    window.addEventListener('keydown',this.key);
    renderer.domElement.addEventListener('pointermove',this.pointer);
  }
  private input(name:string):HTMLInputElement{return this.controls.get(name)!;}
  syncFromLighting():void {
    this.input('enabled').checked=this.lighting.enabled;
    this.input('fullAmbient').checked=this.lighting.fullAmbient;
    this.input('ambient').value=String(this.lighting.ambient);
    this.input('mode').value=this.lighting.quantization?'1':'0';
    this.input('levels').value=String(this.lighting.quantization||4);
  }
  private readonly stopKeys=(event:KeyboardEvent):void=>{if(event.code!=='F6'&&event.code!=='F11')event.stopPropagation();};
  private readonly change=():void=>{
    this.lighting.enabled=this.input('enabled').checked;
    this.lighting.fullAmbient=this.input('fullAmbient').checked;
    this.lighting.setAmbient(Number(this.input('ambient').value));
    this.lighting.quantization=this.input('mode').value==='1'?Number(this.input('levels').value):0;
    this.lighting.resolutionScale=Number(this.input('resolution').value);
    this.lighting.showBounds=this.input('bounds').checked;
    if(this.input('freeze').checked&&!this.manualRestore)this.manualRestore=this.freeze();
    else if(!this.input('freeze').checked&&this.manualRestore){this.manualRestore();this.manualRestore=undefined;}
  };
  private readonly key=(event:KeyboardEvent):void=>{if(event.code==='F6'){event.preventDefault();this.root.hidden=!this.root.hidden;if(!this.root.hidden)this.syncFromLighting();}};
  private readonly pointer=(event:PointerEvent):void=>{const r=this.renderer.domElement.getBoundingClientRect();this.mouseX=(event.clientX-r.left)/r.width*2-1;this.mouseY=1-(event.clientY-r.top)/r.height*2;};
  beforeRender(camera:OrthographicCamera,player:{x:number;y:number}):void {
    const light=this.lighting;
    this.benchmarkCamera=camera;
    this.cameraX=camera.position.x;this.cameraY=camera.position.y;
    if(light.enabled&&!this.run){camera.position.x+=Number(this.input('cameraX').value);camera.position.y+=Number(this.input('cameraY').value);}
    if(this.run){
      const r=this.run,now=performance.now();
      if(r.kind==='soak'){
        light.update(Math.min(.1,(now-r.last)/1000));
        light.onVfx('fx.muzzle.machineGun',player.x,player.y+13);
        if(r.frame%10===0)light.onVfx('fx.explosion.medium',player.x+30,player.y+20);
      }else if(r.frame===0)this.testLights(this.counts[r.phase]!);
      return;
    }
    if(!light.enabled){this.debugLight=this.warningLight=undefined;return;}
    if(this.input('debug').checked){
      if(!this.debugLight?.active||this.debugLight.generation!==this.debugGeneration){
        this.debugLight=light.addLight({x:player.x,y:player.y,radius:64,intensity:1.5,color:0xffffff});
        this.debugGeneration=this.debugLight?.generation??0;
      }
      if(this.debugLight){
        this.point.set(this.mouseX,this.mouseY,0);camera.updateMatrixWorld();this.point.unproject(camera);
        this.debugLight.x=this.input('follow').value==='Mouse'?this.point.x:player.x;
        this.debugLight.y=this.input('follow').value==='Mouse'?this.point.y:player.y+13;
        this.debugLight.radius=Number(this.input('radius').value);this.debugLight.color.setHex(Number(this.input('color').value));
      }
    }else if(this.debugLight){if(this.debugLight.generation===this.debugGeneration)this.debugLight.active=false;this.debugLight=undefined;}
    if(this.input('warning').checked){
      if(!this.warningLight?.active||this.warningLight.generation!==this.warningGeneration){
        this.warningLight=light.addLight({...this.warning,radius:64,intensity:1.2,color:0xff3520});
        this.warningGeneration=this.warningLight?.generation??0;
      }
    }else if(this.warningLight){if(this.warningLight.generation===this.warningGeneration)this.warningLight.active=false;this.warningLight=undefined;}
  }
  afterRender():void {
    if(this.benchmarkCamera){this.benchmarkCamera.position.x=this.cameraX;this.benchmarkCamera.position.y=this.cameraY;}
    const now=performance.now();this.elapsed+=this.last?now-this.last:0;this.last=now;this.frames++;
    if(this.run){
      const r=this.run,delta=now-r.last;r.last=now;r.frame++;
      if(r.kind==='benchmark'){
        if(r.frame>60){r.sum+=delta;r.cpu+=this.lighting.renderMs;r.calls+=this.lighting.drawCalls;}
        if(r.frame===180){
          r.rows.push({lights:this.counts[r.phase],staticLights:this.lighting.staticLights.length,fps:120000/r.sum,frameMs:r.sum/120,cpuSubmitMs:r.cpu/120,drawCalls:r.calls/120,targets:this.lighting.renderTargetCount,targetBytes:this.lighting.targetBytes,...this.memory()});
          r.phase++;r.frame=0;r.sum=r.cpu=r.calls=0;
          this.report.textContent=JSON.stringify(r.rows,null,2);
          if(r.phase===this.counts.length)this.stopTest();
        }
      }else{
        if(r.frame%300===0){r.memory.push({seconds:(now-r.start)/1000,active:this.lighting.activeCount,...this.memory()});this.report.textContent=JSON.stringify(r.memory,null,2);}
        if(now-r.start>=180000){this.lighting.update(1);r.memory.push({seconds:180,activeAfterExpiry:this.lighting.temporaryCount,...this.memory()});this.report.textContent=JSON.stringify(r.memory,null,2);this.stopTest();}
      }
    }
    if(this.elapsed<500)return;
    this.stats.textContent=`${(this.frames*1000/this.elapsed).toFixed(1)} FPS · ${(this.elapsed/this.frames).toFixed(2)} ms/frame\nCPU submit ${this.lighting.renderMs.toFixed(2)} ms\nStatic ${this.lighting.staticLights.length} · Attached ${this.lighting.attachedCount}/16 · Temp ${this.lighting.temporaryCount}/32\nVisible ${this.lighting.visibleCount} · Submitted ${this.lighting.submittedCount} (no culling) · calls ${this.lighting.drawCalls}\nTargets ${this.lighting.renderTargetCount} · ~${(this.lighting.targetBytes/1048576).toFixed(2)} MiB\nGPU textures ${this.renderer.info.memory.textures}\nGPU memory unavailable (target estimate only)`;
    this.elapsed=this.frames=0;
  }
  private memory():object {
    const memory=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory;
    return {textures:this.renderer.info.memory.textures,geometries:this.renderer.info.memory.geometries,programs:this.renderer.info.programs?.length,heapBytes:memory?.usedJSHeapSize??null};
  }
  private testLights(count:number):void {
    this.lighting.enabled=count>=0;this.lighting.clear();
    if(!this.benchmarkCamera)return;
    this.benchmarkCamera.updateMatrixWorld();
    for(let i=0;i<count;i++){
      this.point.set(-.8+(i%8)/7*1.6,-.6+Math.floor(i/8)*.4,0).unproject(this.benchmarkCamera);
      this.lighting.addLight({x:this.point.x,y:this.point.y,radius:60,intensity:.7,color:i%3===0?0xff3520:i%3===1?0xffcb80:0xffffff});
    }
  }
  private startTest(kind:'benchmark'|'soak'):void {
    this.stopTest();this.restore=this.freeze();this.lighting.clear();this.debugLight=this.warningLight=undefined;
    this.lighting.enabled=true;
    const now=performance.now();this.run={kind,phase:0,frame:0,start:now,last:now,sum:0,cpu:0,calls:0,rows:[],memory:[{seconds:0,...this.memory()}]};
    this.report.textContent=kind==='benchmark'?'Measuring OFF / ON 0 / 1 / 4 / 8 / 16 / 32 temporary lights plus the level static lights. 60 warmup + 120 sample frames each.':'3-minute pooled muzzle/explosion light test; scene frozen, visual lights only.';
  }
  private stopTest():void {this.run=undefined;this.restore?.();this.restore=undefined;this.lighting.clear();this.debugLight=this.warningLight=undefined;this.change();}
  dispose():void {this.stopTest();this.manualRestore?.();window.removeEventListener('keydown',this.key);this.renderer.domElement.removeEventListener('pointermove',this.pointer);this.root.remove();}
}
