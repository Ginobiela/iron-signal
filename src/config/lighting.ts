/** Visual-only profiles, in world units and seconds. No weapon/projectile timing lives here. */
export const ATTACHED_LIGHT_CAPACITY = 16;
export const LIGHT_PROFILES = {
  rifle: {radius:22,intensity:2,color:0xffcb80,lifetime:.06},
  machineGun: {radius:22,intensity:1.8,color:0xffcb80,lifetime:.05},
  spread: {radius:30,intensity:2.2,color:0xffcb80,lifetime:.07},
  laser: {radius:26,intensity:1.8,color:0x99edff,lifetime:.065},
  small: {radius:36,intensity:2.2,color:0xffb35c,lifetime:.2},
  medium: {radius:56,intensity:2.7,color:0xffb35c,lifetime:.3},
  missile: {radius:18,intensity:.8,color:0xffb35c},
  launcher: {radius:28,intensity:1.5,color:0xffcb80,lifetime:.1},
  bossHit: {radius:24,intensity:1.2,color:0xffd5a0,lifetime:.08},
  hatch: {radius:24,intensity:.65,color:0xffcb80,offsetX:16,offsetY:12},
} as const;
export const GATE_DEATH_FLASHES = [
  {at:.08,x:10,y:12,effect:'fx.explosion.small'},
  {at:.18,x:46,y:38,effect:'fx.explosion.small'},
  {at:.3,x:28,y:62,effect:'fx.explosion.medium'},
] as const;
