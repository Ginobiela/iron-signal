export interface LevelLight {
  behavior?: 'static' | 'flicker' | 'pulse'; speed?: number; amount?: number;
  id: string; type: 'point'; x: number; y: number; radius: number; intensity: number; color: string;
}
export interface LevelLighting {
  enabled: boolean; ambient: number; mode: 'smooth' | 'quantized'; quantizationLevels?: number; lights: LevelLight[];
}
export const STATIC_LIGHT_CAPACITY = 32;
export const TEMPORARY_LIGHT_CAPACITY = 32;
export const defaultLevelLighting = (): LevelLighting => ({ enabled: false, ambient: 1, mode: 'smooth', quantizationLevels: 4, lights: [] });
/** Shared import/runtime boundary; undefined preserves the pre-lighting pipeline. */
export function validateLighting(value: unknown): string[] {
  if (value === undefined) return [];
  const errors: string[] = [];
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!record(value)) return ['lighting: object required.'];
  if (typeof value.enabled !== 'boolean' || !finite(value.ambient) || value.ambient < 0 || value.ambient > 1
    || !['smooth','quantized'].includes(String(value.mode))) errors.push('lighting: invalid enabled/ambient/mode.');
  if ((value.mode === 'quantized' || value.quantizationLevels !== undefined)
    && (!finite(value.quantizationLevels) || !Number.isInteger(value.quantizationLevels) || value.quantizationLevels < 2 || value.quantizationLevels > 5)) errors.push('lighting: quantizationLevels must be 2–5.');
  if (!Array.isArray(value.lights) || value.lights.length > STATIC_LIGHT_CAPACITY) return [...errors, 'lighting: maximum 32 static lights.'];
  const ids = new Set<string>();
  for (const light of value.lights) {
    if (!record(light)) { errors.push('light: object required.'); continue; }
    if (typeof light.id !== 'string' || !light.id.trim() || ids.has(light.id)) errors.push('light: missing/duplicate id.');
    else ids.add(light.id);
    if ((light.behavior!==undefined&&!['static','flicker','pulse'].includes(String(light.behavior)))
      ||(light.speed!==undefined&&(!finite(light.speed)||light.speed<.1||light.speed>20))
      ||(light.amount!==undefined&&(!finite(light.amount)||light.amount<0||light.amount>1))) errors.push('light: invalid behavior/speed/amount.');
    if (light.type !== 'point' || !finite(light.x) || !finite(light.y) || !finite(light.radius) || light.radius <= 0 || light.radius > 2048
      || !finite(light.intensity) || light.intensity < 0 || light.intensity > 4 || typeof light.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(light.color)) errors.push('light: invalid point/position/radius/intensity/color.');
  }
  return errors;
}

/** Deterministic modulation in [1-amount,1], never changes the authored intensity. */
export function lightModulation(behavior: LevelLight['behavior'],time:number,speed=1,amount=.2,seed=0):number {
  if(behavior==='pulse')return 1-amount*(.5+.5*Math.sin(time*speed*Math.PI*2+seed));
  if(behavior==='flicker'){const n=Math.sin((Math.floor(time*speed*8)+seed+1)*12.9898)*43758.5453;return 1-amount*(n-Math.floor(n));}
  return 1;
}
