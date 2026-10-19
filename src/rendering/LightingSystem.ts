import { ATTACHED_LIGHT_CAPACITY, LIGHT_PROFILES } from '../config/lighting';
import { defaultLevelLighting, validateLighting, lightModulation, STATIC_LIGHT_CAPACITY, TEMPORARY_LIGHT_CAPACITY } from '../level/LevelLighting';
import type { LevelLighting } from '../level/LevelLighting';
import { Color, Matrix4, Mesh, NearestFilter, NoBlending, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderTarget } from 'three';
import type { WebGLRenderer } from 'three';

export interface LightData { x: number; y: number; radius: number; intensity: number; color: number; lifetime?: number }
export interface LightSource { position: {x:number;y:number}; readonly active:boolean }
export interface AttachedLightProfile { radius:number;intensity:number;color:number;offsetX?:number;offsetY?:number }
export interface AttachedLightSlot extends LightSlot { source?:LightSource; offsetX:number;offsetY:number }
export interface LightSlot { source?:LightSource;behavior?:'static'|'flicker'|'pulse';speed?:number;amount?:number;seed?:number; x: number; y: number; radius: number; intensity: number; color: Color; life: number; duration: number; active: boolean; generation: number }
const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const lightShader = `
varying vec2 vUv;
uniform mat4 worldFromClip;
uniform vec4 lights[80];
uniform vec3 colors[80];
uniform int count;
uniform float ambient;
uniform float levels;
uniform bool bounds;
void main(){
  vec4 p=worldFromClip*vec4(vUv*2.-1.,0.,1.);
  vec3 light=vec3(ambient);
  for(int i=0;i<80;i++){
    if(i>=count) break;
    float d=distance(p.xy/p.w,lights[i].xy);
    float falloff=max(0.,1.-d/lights[i].z);
    light+=colors[i]*lights[i].w*falloff*falloff;
  }
  light=clamp(light,0.,1.);
  if(levels>1.) light=floor(light*(levels-1.)+.5)/(levels-1.);
  float ring=0.;
  if(bounds) for(int i=0;i<80;i++){
    if(i>=count) break;
    ring=max(ring,1.-step(.65,abs(distance(p.xy/p.w,lights[i].xy)-lights[i].z)));
  }
  gl_FragColor=vec4(light,ring);
}`;
const compositeShader = `
varying vec2 vUv;
uniform sampler2D sceneMap;
uniform sampler2D lightMap;
void main(){
  vec4 lighting=texture2D(lightMap,vUv);
  gl_FragColor=vec4(mix(texture2D(sceneMap,vUv).rgb*lighting.rgb,vec3(0.,1.,.6),lighting.a),1.);
  #include <colorspace_fragment>
}`;

/** World-space lightmap: 32 static + 32 temporary + 16 attached lights; bounded uniforms and reusable slots. */
export class LightingSystem {
  readonly slots: LightSlot[] = Array.from({length:TEMPORARY_LIGHT_CAPACITY},()=>({x:0,y:0,radius:1,intensity:0,color:new Color(),life:0,duration:0,active:false,generation:0}));
  readonly attachedLights: AttachedLightSlot[] = Array.from({length:ATTACHED_LIGHT_CAPACITY},()=>({x:0,y:0,radius:1,intensity:0,color:new Color(),life:Infinity,duration:Infinity,active:false,generation:0,offsetX:0,offsetY:0}));
  readonly staticLights: LightSlot[] = [];
  private time=0;
  intensityMultiplier=1;
  temporaryMultiplier=1;
  fullAmbient=false;
  visibleCount=0;
  submittedCount=0;
  ambient = .35;
  quantization = 0;
  showBounds = false;
  resolutionScale = .5;
  dropped = 0;
  renderMs = 0;
  drawCalls = 0;
  private on = false;
  private targets?: { scene: WebGLRenderTarget; light: WebGLRenderTarget };
  private readonly size = new Vector2();
  private readonly positions = Array.from({length:STATIC_LIGHT_CAPACITY+TEMPORARY_LIGHT_CAPACITY+ATTACHED_LIGHT_CAPACITY},()=>new Vector4());
  private readonly colors = this.positions.map(()=>new Vector3());
  private readonly worldFromClip = new Matrix4();
  private readonly geometry = new PlaneGeometry(2,2);
  private readonly passScene = new Scene();
  private readonly passCamera = new OrthographicCamera(-1,1,1,-1,0,1);
  private readonly lightMaterial = new ShaderMaterial({vertexShader,fragmentShader:lightShader,depthTest:false,depthWrite:false,blending:NoBlending, uniforms:{
    worldFromClip:{value:this.worldFromClip},lights:{value:this.positions},colors:{value:this.colors},count:{value:0},ambient:{value:.35},levels:{value:0},bounds:{value:false},
  }});
  private readonly compositeMaterial = new ShaderMaterial({vertexShader,fragmentShader:compositeShader,depthTest:false,depthWrite:false,blending:NoBlending,uniforms:{sceneMap:{value:null},lightMap:{value:null}}});
  private readonly quad = new Mesh(this.geometry,this.lightMaterial);

  constructor(){this.quad.frustumCulled=false;this.passScene.add(this.quad);}
  get enabled(): boolean { return this.on; }
  set enabled(value: boolean) { this.on=value; if(!value)this.clear(); }
  get temporaryCount(): number { let n=0; for(const light of this.slots) if(light.active)n++;return n; }
  get attachedCount():number {this.syncAttached();let n=0;for(const s of this.attachedLights)if(s.active)n++;return n;}
  get activeCount(): number { return this.enabled ? this.staticLights.length + this.temporaryCount + this.attachedCount : 0; }
  attach(source:LightSource,profile:AttachedLightProfile):AttachedLightSlot|undefined {
    if(!this.enabled||!source.active)return;
    this.syncAttached();
    const current=this.attachedLights.find(s=>s.active&&s.source===source);if(current)return current;
    if(!Number.isFinite(source.position.x)||!Number.isFinite(source.position.y)||!Number.isFinite(profile.radius)||profile.radius<=0||profile.radius>2048
      ||!Number.isFinite(profile.intensity)||profile.intensity<0||profile.intensity>4||!Number.isInteger(profile.color)||profile.color<0||profile.color>0xffffff
      ||(profile.offsetX!==undefined&&!Number.isFinite(profile.offsetX))||(profile.offsetY!==undefined&&!Number.isFinite(profile.offsetY)))return;
    const slot=this.attachedLights.find(s=>!s.active);if(!slot){this.dropped++;return;}
    slot.source=source;slot.radius=profile.radius;slot.intensity=profile.intensity;slot.color.setHex(profile.color);
    slot.offsetX=profile.offsetX??0;slot.offsetY=profile.offsetY??0;slot.active=true;slot.generation++;
    this.syncAttached();return slot;
  }
  syncAttached():void {
    for(const s of this.slots)if(s.active&&s.source){
      if(!s.source.active||!Number.isFinite(s.source.position.x)||!Number.isFinite(s.source.position.y)){
        s.active=false;s.source=undefined;continue;
      }
      s.x=s.source.position.x;s.y=s.source.position.y;
    }
    for(const s of this.attachedLights)if(s.active){
      const source=s.source;
      if(!source?.active||!Number.isFinite(source.position.x)||!Number.isFinite(source.position.y)){s.active=false;s.source=undefined;continue;}
      s.x=source.position.x+s.offsetX;s.y=source.position.y+s.offsetY;
    }
  }
  setMultiplier(kind:'intensity'|'temporary',value:number):void {
    if(!Number.isFinite(value))return;const next=Math.max(0,Math.min(2,value));
    if(kind==='intensity')this.intensityMultiplier=next;else this.temporaryMultiplier=next;
  }
  loadLevel(config?: LevelLighting): void {
    const errors=validateLighting(config);if(errors.length)throw new Error(errors.join("\n"));
    const data=config??defaultLevelLighting();
    this.clear();this.time=0;this.staticLights.length=0;this.enabled=data.enabled;this.setAmbient(data.ambient);
    this.quantization=data.mode==='quantized'?data.quantizationLevels!:0;
    for(const [i,light] of data.lights.entries())this.staticLights.push({behavior:light.behavior,speed:light.speed,amount:light.amount,seed:i*2.399,x:light.x,y:light.y,radius:light.radius,intensity:light.intensity,color:new Color(light.color),life:Infinity,duration:Infinity,active:true,generation:0});
  }
  get renderTargetCount(): number { return this.targets?2:0; }
  get targetBytes(): number { const t=this.targets;return t?t.scene.width*t.scene.height*8+t.light.width*t.light.height*4:0; }
  setAmbient(value:number):void { if(Number.isFinite(value))this.ambient=Math.max(0,Math.min(1,value)); }
  addLight(data:LightData):LightSlot|undefined {
    if(!this.enabled||![data.x,data.y,data.radius,data.intensity,data.color].every(Number.isFinite)||data.radius<=0||!Number.isInteger(data.color)||data.color<0||data.color>0xffffff||
      (data.lifetime!==undefined&&(!Number.isFinite(data.lifetime)||data.lifetime<=0)))return;
    const slot=this.slots.find(s=>!s.active);
    if(!slot){this.dropped++;return;}
    slot.x=data.x;slot.y=data.y;slot.radius=Math.min(2048,data.radius);slot.intensity=Math.max(0,Math.min(4,data.intensity));
    slot.color.setHex(data.color);slot.duration=slot.life=data.lifetime??Infinity;slot.source=undefined;slot.active=true;slot.generation++;return slot;
  }
  update(dt:number):void {
    if(!this.enabled||!Number.isFinite(dt)||dt<=0)return;
    this.time+=dt;this.syncAttached();
    for(const slot of this.slots)if(slot.active){
      if(slot.duration!==Infinity){slot.life=Math.max(0,slot.life-dt);if(slot.life===0){slot.active=false;slot.source=undefined;}}
    }
  }
  clear():void {for(const s of this.slots){s.active=false;s.source=undefined;}for(const s of this.attachedLights){s.active=false;s.source=undefined;}}
  /** Called by the existing visual effect pool, never Player/Weapon logic. */
  onVfx(id:string,x:number,y:number,source?:LightSource):void {
    if(!this.enabled)return;
    const profile=id==='fx.muzzle.rifle'?LIGHT_PROFILES.rifle:id==='fx.muzzle.machineGun'?LIGHT_PROFILES.machineGun
      :id==='fx.muzzle.spread'?LIGHT_PROFILES.spread:id==='fx.muzzle.laser'?LIGHT_PROFILES.laser
      :id==='fx.explosion.small'?LIGHT_PROFILES.small:id==='fx.explosion.medium'?LIGHT_PROFILES.medium:undefined;
    if(profile){const slot=this.addLight({x,y,...profile});if(slot)slot.source=source;}
  }
  render(renderer:WebGLRenderer,scene:Scene,camera:OrthographicCamera):void {
    const start=performance.now();
    this.syncAttached();
    if(!this.enabled||this.fullAmbient){this.visibleCount=this.submittedCount=0;renderer.render(scene,camera);this.drawCalls=renderer.info.render.calls;this.renderMs=performance.now()-start;return;}
    renderer.getDrawingBufferSize(this.size);
    const w=this.size.x,h=this.size.y,scale=this.resolutionScale===1?1:.5;
    if(!this.targets){
      const options={minFilter:NearestFilter,magFilter:NearestFilter,generateMipmaps:false};
      this.targets={scene:new WebGLRenderTarget(w,h,options),light:new WebGLRenderTarget(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)),{...options,depthBuffer:false})};
      this.compositeMaterial.uniforms.sceneMap!.value=this.targets.scene.texture;
      this.compositeMaterial.uniforms.lightMap!.value=this.targets.light.texture;
    }
    const targets=this.targets;
    targets.scene.setSize(w,h);targets.light.setSize(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));
    camera.updateMatrixWorld();this.worldFromClip.multiplyMatrices(camera.matrixWorld,camera.projectionMatrixInverse);
    this.syncAttached();let count=0;this.visibleCount=0;
    const left=camera.position.x+camera.left/camera.zoom,right=camera.position.x+camera.right/camera.zoom;
    const bottom=camera.position.y+camera.bottom/camera.zoom,top=camera.position.y+camera.top/camera.zoom;
    for(let i=0;i<this.staticLights.length+this.slots.length+this.attachedLights.length;i++){
      const temporary=i>=this.staticLights.length&&i<this.staticLights.length+this.slots.length;
      const slot=i<this.staticLights.length?this.staticLights[i]!:temporary?this.slots[i-this.staticLights.length]!:this.attachedLights[i-this.staticLights.length-this.slots.length]!;
      if(!slot.active)continue;
      if(slot.x+slot.radius>=left&&slot.x-slot.radius<=right&&slot.y+slot.radius>=bottom&&slot.y-slot.radius<=top)this.visibleCount++;
      const modulation=lightModulation(slot.behavior,this.time,slot.speed,slot.amount,slot.seed);
      this.positions[count]!.set(slot.x,slot.y,slot.radius,slot.intensity*modulation*this.intensityMultiplier*(temporary?this.temporaryMultiplier:1)*(slot.duration===Infinity?1:slot.life/slot.duration));
      this.colors[count]!.set(slot.color.r,slot.color.g,slot.color.b);count++;
    }
    this.submittedCount=count;this.lightMaterial.uniforms.count!.value=count;this.lightMaterial.uniforms.ambient!.value=this.ambient;
    this.lightMaterial.uniforms.levels!.value=this.quantization;this.lightMaterial.uniforms.bounds!.value=this.showBounds;
    const previous=renderer.getRenderTarget(),autoReset=renderer.info.autoReset;
    renderer.info.autoReset=false;renderer.info.reset();
    try {
      renderer.setRenderTarget(targets.scene);renderer.render(scene,camera);
      this.quad.material=this.lightMaterial;renderer.setRenderTarget(targets.light);renderer.render(this.passScene,this.passCamera);
      this.quad.material=this.compositeMaterial;renderer.setRenderTarget(previous);renderer.render(this.passScene,this.passCamera);
      this.drawCalls=renderer.info.render.calls;
    }finally{renderer.setRenderTarget(previous);renderer.info.autoReset=autoReset;}
    this.renderMs=performance.now()-start;
  }
  dispose():void {this.clear();this.staticLights.length=0;this.targets?.scene.dispose();this.targets?.light.dispose();this.geometry.dispose();this.lightMaterial.dispose();this.compositeMaterial.dispose();}
}
