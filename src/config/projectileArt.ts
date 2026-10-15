/** Visual identities only. Projectile style still controls laser/missile gameplay. */
export const WEAPON_PROJECTILE_ART: Readonly<Record<string, string>> = {
  RIFLE: 'projectile.player.rifle', 'MACHINE GUN': 'projectile.player.machinegun',
  SPREAD: 'projectile.player.spread', LASER: 'projectile.player.laser',
};
export const PROJECTILE_ART = {
  'projectile.player.rifle': 'player_rifle',
  'projectile.player.machinegun': 'player_machinegun',
  'projectile.player.spread': 'player_spread',
  'projectile.player.laser': 'player_laser',
  'projectile.enemy.soldier': 'enemy_soldier',
  'projectile.enemy.turret': 'enemy_turret',
  'projectile.enemy.arena': 'boss_lvl1_arena',
  'projectile.enemy.bossGateTurret': 'boss_lvl3_gate',
} as const;
