export const ENVIRONMENT = { tile: 16, sliceStart: 0, sliceEnd: 1024, seed: 17 } as const;

export interface EnvironmentAsset {
  /** width/height remain world units. artScale affects source metadata only. */
  artScale?: 1 | 2;
  file: string; width: number; height: number; frames?: number; fps?: number;
  layer: 'tiles' | 'back' | 'front' | 'marker' | 'far' | 'mid' | 'near';
  tileable?: boolean; enabled?: boolean;
}

export const ENVIRONMENT_ASSETS = {
  'environment.ground.fill': { file: 'tiles/jungle/ground_fill', width: 16, height: 16, layer: 'tiles', artScale: 2, enabled: true, tileable: true },
  'environment.ground.top01': { file: 'tiles/jungle/ground_top_01', width: 16, height: 16, layer: 'tiles', artScale: 2, enabled: true, tileable: true },
  'environment.ground.top02': { file: 'tiles/jungle/ground_top_02', width: 16, height: 16, layer: 'tiles', artScale: 2, enabled: true, tileable: true },
  'environment.ground.top03': { file: 'tiles/jungle/ground_top_03', width: 16, height: 16, layer: 'tiles', artScale: 2, enabled: true, tileable: true },
  'environment.ground.left': { file: 'tiles/jungle/ground_left_edge', width: 16, height: 16, layer: 'tiles', artScale: 2, enabled: true, tileable: true },
  'environment.ground.right': { file: 'tiles/jungle/ground_right_edge', width: 16, height: 16, layer: 'tiles', artScale: 2, enabled: true, tileable: true },
  'environment.ground.topLeft': { file: 'tiles/jungle/ground_top_left', width: 16, height: 16, layer: 'tiles', artScale: 2, enabled: true },
  'environment.ground.topRight': { file: 'tiles/jungle/ground_top_right', width: 16, height: 16, layer: 'tiles', artScale: 2, enabled: true },
  'environment.platform.left': { file: 'tiles/military/platform_metal_left', width: 16, height: 8, layer: 'tiles', artScale: 2, enabled: true },
  'environment.platform.middle': { file: 'tiles/military/platform_metal_middle', width: 16, height: 8, layer: 'tiles', artScale: 2, enabled: true, tileable: true },
  'environment.platform.right': { file: 'tiles/military/platform_metal_right', width: 16, height: 8, layer: 'tiles', artScale: 2, enabled: true },
  'environment.platform.single': { file: 'tiles/military/platform_metal_single', width: 16, height: 8, layer: 'tiles', artScale: 2, enabled: true },
  'environment.wall.bunker': { file: 'tiles/military/bunker_wall', width: 16, height: 16, layer: 'back', artScale: 2, enabled: true, tileable: true },
  'environment.wall.concrete': { file: 'tiles/military/concrete_wall', width: 16, height: 16, layer: 'back', artScale: 2, enabled: true, tileable: true },
  'environment.prop.grass': { file: 'props/jungle/grass', width: 16, height: 8, layer: 'back', artScale: 2, enabled: true },
  'environment.prop.vines': { file: 'props/jungle/vines', width: 16, height: 32, layer: 'back', artScale: 2, enabled: true },
  'environment.prop.plant': { file: 'props/jungle/small_plant', width: 24, height: 24, layer: 'back', artScale: 2, enabled: true },
  'environment.prop.rock': { file: 'props/jungle/rock', width: 16, height: 12, layer: 'back', artScale: 2, enabled: true },
  'environment.prop.branch': { file: 'props/jungle/foreground_branch', width: 32, height: 12, layer: 'front', artScale: 2, enabled: true },
  'environment.prop.crate': { file: 'props/military/crate', width: 16, height: 16, layer: 'back', artScale: 2, enabled: true },
  'environment.prop.barrel': { file: 'props/military/barrel', width: 12, height: 20, layer: 'back', artScale: 2, enabled: true },
  'environment.prop.pipe': { file: 'props/military/pipe', width: 16, height: 16, layer: 'back', artScale: 2, enabled: true },
  'environment.prop.barrier': { file: 'props/military/barrier', width: 32, height: 16, layer: 'back', artScale: 2, enabled: true },
  'environment.prop.sign': { file: 'props/military/warning_sign', width: 16, height: 24, layer: 'back', artScale: 2, enabled: true },
  'environment.animated.vent': { file: 'animated/vent_fan', width: 16, height: 16, frames: 4, fps: 6, layer: 'back', artScale: 2, enabled: true },
  'environment.checkpoint.waiting': { file: 'animated/checkpoint_waiting', width: 16, height: 32, frames: 2, fps: 3, layer: 'marker', artScale: 2, enabled: true },
  'environment.checkpoint.active': { file: 'animated/checkpoint_active', width: 16, height: 32, frames: 4, fps: 6, layer: 'marker', artScale: 2, enabled: true },
  'background.far': { file: 'background/far/bg_jungle_far', width: 256, height: 240, layer: 'far', artScale: 2, enabled: true, tileable: true },
  'background.mid': { file: 'background/mid/bg_jungle_mid', width: 256, height: 240, layer: 'mid', artScale: 2, enabled: true, tileable: true },
  'background.near': { file: 'background/near/bg_jungle_near', width: 256, height: 240, layer: 'near', artScale: 2, enabled: true, tileable: true },
} as const satisfies Record<string, EnvironmentAsset>;
export type EnvironmentId = keyof typeof ENVIRONMENT_ASSETS;

export const ENVIRONMENT_PROPS: readonly { id: EnvironmentId; x: number; y: number }[] = [
  { id: 'environment.prop.plant', x: 30, y: 44 },
  { id: 'environment.prop.grass', x: 116, y: 44 },
  { id: 'environment.prop.rock', x: 298, y: 44 },
  { id: 'environment.prop.vines', x: 408, y: 116 },
  { id: 'environment.prop.crate', x: 420, y: 44 },
  { id: 'environment.prop.sign', x: 486, y: 44 },
  { id: 'environment.prop.grass', x: 592, y: 44 },
  { id: 'environment.prop.barrel', x: 754, y: 44 },
  { id: 'environment.animated.vent', x: 792, y: 104 },
  { id: 'environment.prop.pipe', x: 856, y: 44 },
  { id: 'environment.prop.barrier', x: 980, y: 44 },
  { id: 'environment.prop.branch', x: 104, y: 206 },
  { id: 'environment.prop.branch', x: 744, y: 214 },
];

export function tileVariant(x: number, y: number, count = 3): number {
  return ((Math.floor(x / ENVIRONMENT.tile) * 31 + Math.floor(y / ENVIRONMENT.tile) * 17 + ENVIRONMENT.seed) >>> 0) % count;
}
