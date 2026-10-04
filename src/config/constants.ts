export const VIEW = { width: 256, height: 240 } as const;
export const TIMING = {
  fixedStep: 1 / 60,
  maxFrameDelta: 0.1,
  fpsInterval: 0.5,
} as const;

export const FEEDBACK = {
  particleCapacity: 192, particleGravity: 180,
  sparkCount: 4, explosionCount: 18, bossExplosionCount: 64, pickupCount: 12,
  sparkLife: 0.18, explosionLife: 0.55,
  muzzleTime: 0.055, recoilPixels: 1, runFrameTime: 0.08,
  shakeLimit: 2, deathShake: 1.5, explosionShake: 1, bossShake: 2,
  shakeTime: 0.16, bossShakeTime: 0.3,
} as const;
export const AUDIO = { defaultVolume: 0.35, maxVoices: 16, hitInterval: 0.04 } as const;

export const CONTROLS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  shoot: ['KeyJ'],
  start: ['Enter'],
  pause: ['Escape'],
  debug: ['F1'],
  graphicsDebug: ['F2'],
} as const;
export type Action = keyof typeof CONTROLS;

export const PLAYER_COLLISION = {
  standing: { width: 12, height: 26 },
  crouching: { width: 12, height: 12 },
} as const;

export const PLAYER = {
  speed: 95,
  jumpSpeed: 210,
  gravity: 600,
  fallGravityMultiplier: 1.2,
  maxFallSpeed: 360,
  coyoteTime: 0.08,
  jumpBuffer: 0.10,
  width: PLAYER_COLLISION.standing.width,
  height: PLAYER_COLLISION.standing.height,
  gunPivotY: 16,
  muzzleDistance: 15,
  maxHealth: 1,
  invulnerabilityTime: 1.5,
  crouchHeight: PLAYER_COLLISION.crouching.height,
  dropOffset: 1,
  dropSpeed: 40,
} as const;

export const CAMERA = {
  forwardAnchor: 0.4,
  backwardAnchor: 0.25,
  deadZone: 8,
} as const;

export const RIFLE = {
  fireRate: 6,
  projectileSpeed: 320,
  damage: 1,
} as const;

export const MACHINE_GUN = { fireRate: 12, projectileSpeed: 360, damage: 1 } as const;
export const SPREAD_GUN = {
  fireRate: 4, projectileSpeed: 280, damage: 1, angles: [-30, -15, 0, 15, 30],
} as const;
export const LASER = { fireRate: 2, projectileSpeed: 480, damage: 3, visualLength: 12 } as const;
export const POWERUPS = {
  size: 12, noticeTime: 1.5, maxCount: 12, gravity: 420, maxFallSpeed: 240,
  initialYSpeed: 35, initialXSpeed: 10, lifetime: 10, warningTime: 2, blinkRate: 8,
} as const;
export const GAMEPLAY = { initialLives: 3, deathDelay: 0.65, checkpointNoticeTime: 1.5 } as const;
export const SCORE = { soldier: 100, runner: 100, turret: 200, flying: 300, boss: 5000 } as const;
export const BOSS = {
  name: 'GUARDIÁN CENITAL', width: 56, height: 72, health: 150,
  phase2Threshold: 0.66, phase3Threshold: 0.30, introTime: 1,
  telegraphTimes: [0.65, 0.55, 0.35], recoveryTimes: [1.1, 1, 0.8],
  bulletSpeeds: [110, 130, 165], burstCount: 2, burstInterval: 0.12, attackTime: 0.24,
  aimedAngles: [-12, 0, 12], highHeight: 23, lowHeight: 8, aimedHeight: 36,
  muzzleOffset: 4, shieldFlashTime: 0.08,
} as const;

export const PROJECTILES = {
  maxCount: 96,
  size: 3,
  lifetime: 2,
  boundsMargin: 32,
} as const;

export const ENEMIES = {
  contactDamage: 1,
  bulletDamage: 1,
  hitFlashTime: 0.10,
  activationMargin: 16,
  soldier: { width: 12, height: 24, health: 2, speed: 24, stopDistance: 48,
    attackInterval: 1.6, firstAttackDelay: 0.9, bulletSpeed: 115, color: 0x8ab07b },
  runner: { width: 14, height: 16, health: 1, speed: 80, jumpSpeed: 190, color: 0xde7967 },
  turret: { width: 20, height: 20, health: 5, attackInterval: 1.25,
    firstAttackDelay: 0.8, bulletSpeed: 130, warningTime: 0.25, color: 0xc8a163 },
  flying: { width: 20, height: 14, health: 2, speed: 48, amplitude: 10,
    frequency: 3, color: 0xb09bd5 },
} as const;

export const WORLD = { killY: -48, enemyRetireDistance: 384 } as const;
export const PARALLAX = { background: 0.15, midground: 0.40, foreground: 0.75 } as const;
