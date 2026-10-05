import { Color, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { CONTROLS, SCORE, VIEW } from '../config/constants';
import type { Action } from '../config/constants';
import { CameraController } from '../camera/CameraController';
import { CollisionSystem } from '../collision/CollisionSystem';
import { CombatSystem } from '../collision/CombatSystem';
import { EnemyManager } from '../entities/enemies/EnemyManager';
import type { EnemyPlacement } from '../entities/enemies/EnemyManager';
import type { EnemyContext } from '../entities/enemies/Enemy';
import { Player } from '../entities/Player';
import type { PlayerControls } from '../entities/Player';
import { Level } from '../level/Level';
import { SIGNAL_WORKS } from '../level/signalWorks';
import { gameplayLab } from '../level/gameplayLab';
import { EnemySpawner } from '../level/EnemySpawner';
import { PowerupManager } from '../level/PowerupManager';
import { CheckpointManager } from '../level/Checkpoint';
import { LevelView } from '../rendering/LevelView';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { PlayerView } from '../rendering/PlayerView';
import { ProjectileManager } from '../projectiles/ProjectileManager';
import { ProjectileView } from '../rendering/ProjectileView';
import { EnemyView } from '../rendering/EnemyView';
import { PowerupView } from '../rendering/PowerupView';
import { CheckpointView } from '../rendering/CheckpointView';
import { CombatHUD } from '../ui/CombatHUD';
import { Menu } from '../ui/Menu';
import { getDisplaySize } from '../rendering/viewport';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { GameStateManager } from './GameStateManager';
import { ScoreManager } from './ScoreManager';
import { Boss } from '../bosses/Boss';
import { BossView } from '../rendering/BossView';
import { BossHUD } from '../ui/BossHUD';
import { AudioManager } from './AudioManager';
import { ParticleManager } from '../rendering/ParticleManager';
import { ParticleView } from '../rendering/ParticleView';
import { ScreenShakeManager } from '../camera/ScreenShakeManager';
import type { Enemy } from '../entities/enemies/Enemy';
import { AssetManager } from './AssetManager';
import { FxSpritePool } from '../rendering/FxSpritePool';
import { enemyMuzzle, playerMuzzle } from '../rendering/vfxOrigins';
import { VFX_SHAKE, WEAPON_VFX } from '../config/vfx';

const actions = Object.keys(CONTROLS) as Action[];
const lab = import.meta.env.DEV ? new URLSearchParams(location.search).get('lab') : null;
const levelData = lab === 'high' || lab === 'low' ? gameplayLab(lab) : SIGNAL_WORKS;

export class Game {
  private readonly scene = new Scene();
  private readonly assets = new AssetManager();
  private readonly camera = new OrthographicCamera(0, VIEW.width, VIEW.height, 0, 0.1, 100);
  private readonly renderer: WebGLRenderer;
  private readonly input: InputManager;
  private readonly level = new Level(levelData);
  private readonly states = new GameStateManager();
  private readonly score = new ScoreManager();
  private readonly audio = new AudioManager();
  private readonly particles = new ParticleManager();
  private readonly particleView = new ParticleView(this.particles);
  private readonly shake = new ScreenShakeManager();
  private readonly fxSprites = new FxSpritePool(this.assets, this.particles, this.shake);
  private readonly muzzlePoint = { x: 0, y: 0, angle: 0 };
  private readonly playerHitPoint = { x: 0, y: 0 };
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly checkpoints = new CheckpointManager({ ...levelData.spawn, name: 'Inicio' }, levelData.checkpoints);
  private readonly checkpointView = new CheckpointView(this.checkpoints);
  private readonly levelView: LevelView;
  private readonly background: ParallaxBackground;
  private readonly player = new Player(levelData.spawn.x, levelData.spawn.y);
  private readonly playerView = new PlayerView(this.assets);
  private readonly collision = new CollisionSystem();
  private readonly powerups = new PowerupManager(this.collision);
  private readonly powerupView = new PowerupView(this.powerups, this.assets);
  private readonly projectiles = new ProjectileManager(this.collision);
  private readonly enemies = new EnemyManager();
  private readonly boss = new Boss(levelData.boss);
  private readonly bossView = new BossView(this.boss, this.assets);
  private readonly enemyViews: EnemyView[] = [];
  private readonly spawner = new EnemySpawner(levelData.spawnGroups, (placement) => this.spawnEnemy(placement));
  private readonly combat = new CombatSystem(this.collision, this.player, this.enemies.items,
    (enemy) => this.onEnemyKilled(enemy), this.boss,
    (target, x, y, damaged) => this.onImpact(target, x, y, damaged));
  private readonly enemyContext: EnemyContext = { player: this.player, projectiles: this.projectiles,
    collision: this.collision, solids: this.level.solids, oneWays: this.level.oneWays, worldWidth: levelData.width };
  private readonly hud: CombatHUD;
  private readonly menu: Menu;
  private readonly bossHUD: BossHUD;
  private readonly projectileView = new ProjectileView(this.projectiles.items.length, this.assets);
  private readonly cameraController = new CameraController(levelData.width);
  private readonly controls: PlayerControls = { left: false, right: false, jumpPressed: false, up: false, shoot: false, down: false };
  private readonly loop: GameLoop;
  private readonly resizeObserver: ResizeObserver;
  private debugVisible = false;
  private graphicsDebugVisible = false;
  private debugTimer = 0;
  private ticks = 0;
  private readonly volumeControl = document.querySelector<HTMLInputElement>('#audio-volume');

  constructor(private readonly viewport: HTMLElement, private readonly debug: HTMLElement,
    status: HTMLElement, notice: HTMLElement, menu: HTMLElement, bossStatus: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: false, alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(VIEW.width, VIEW.height, false);
    this.renderer.domElement.setAttribute('aria-label', 'Iron Signal: A/D correr, Space saltar, J disparar, W apuntar arriba, S agacharse, S + Space bajar');
    viewport.prepend(this.renderer.domElement);
    this.scene.background = new Color(0x101e2c);
    this.camera.position.z = 10;
    this.background = new ParallaxBackground(this.scene, this.assets);
    this.levelView = new LevelView(this.scene, this.level, this.assets);
    this.scene.add(this.playerView.root, this.projectileView.mesh, this.powerupView.root, this.checkpointView.root, this.bossView.root);
    this.scene.add(this.particleView.mesh);
    this.scene.add(this.projectileView.bounds);
    this.scene.add(this.projectileView.sprites, this.fxSprites.root);
    void this.assets.preload();
    this.hud = new CombatHUD(status, notice);
    this.menu = new Menu(menu);
    this.bossHUD = new BossHUD(bossStatus);
    this.states.ready();
    this.updateHUD();
    this.playerView.update(this.player, 0);
    this.input = new InputManager();
    this.loop = new GameLoop(this.update, this.render);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(viewport);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    if (this.volumeControl) {
      this.volumeControl.value = String(this.audio.volume);
      this.volumeControl.addEventListener('input', this.onVolume);
    }
    this.resize();
  }

  start(): void {
    if (!document.hidden) this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.volumeControl?.removeEventListener('input', this.onVolume);
    this.audio.dispose();
    this.fxSprites.dispose();
    this.particleView.dispose();
    this.levelView.dispose();
    this.background.dispose();
    this.playerView.dispose();
    this.projectileView.dispose();
    this.powerupView.dispose();
    this.checkpointView.dispose();
    this.bossView.dispose();
    for (const view of this.enemyViews) view.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.assets.dispose();
    this.renderer.domElement.remove();
  }

  private readonly update = (dt: number): void => {
    this.ticks++;
    if (this.input.wasPressed('start')) {
      if (this.states.state === 'PAUSED') {
        this.states.resume();
        this.input.clear();
      } else if (this.states.start()) {
        this.resetRun();
        this.input.clear();
      }
    }
    if (this.input.wasPressed('pause')) {
      this.states.togglePause();
      this.input.clear();
    }
    if (this.states.state === 'PLAYING') this.updatePlaying(dt);
    else if (this.states.update(dt)) this.respawn();
    const visualStep = this.states.state === 'PLAYING' ? dt : 0;
    const effectStep = this.states.state === 'PAUSED' || this.states.state === 'MENU' ? 0 : dt;
    this.particles.update(effectStep);
    this.fxSprites.update(effectStep);
    this.shake.update(effectStep);
    if (this.reducedMotion.matches) this.shake.clear();
    this.particleView.update();
    for (const view of this.enemyViews) view.update(effectStep);
    this.updateHUD();
    this.projectileView.update(this.projectiles, visualStep);
    this.powerupView.update(visualStep);
    this.levelView.update(visualStep);
    this.checkpointView.update();
    this.bossView.update(effectStep);
    this.playerView.update(this.player, effectStep);
    this.camera.position.x = Math.round(this.cameraController.x) + this.shake.offset.x;
    this.camera.position.y = this.shake.offset.y;
    this.background.update(this.cameraController.x);
    if (this.states.state === 'PAUSED') this.audio.silence();
    this.updateDebug(dt);
    this.input.endStep();
  };

  private updatePlaying(dt: number): void {
    const jumps = this.player.jumpCount;
    const collected = this.powerups.collectedCount;
    const checkpoint = this.checkpoints.current;
    const shots = this.projectiles.playerSpawned;
    const playerHits = this.combat.playerHits;
    const bossState = this.boss.state;
    const bossPhase = this.boss.phase;
    this.controls.left = this.input.isDown('left');
    this.controls.right = this.input.isDown('right');
    this.controls.jumpPressed = this.input.wasPressed('jump');
    this.controls.up = this.input.isDown('up');
    this.controls.down = this.input.isDown('down');
    this.controls.shoot = this.input.isDown('shoot') || this.input.wasPressed('shoot');
    this.player.update(dt, this.controls, this.collision, this.level.solids, levelData.width, this.level.oneWays);
    this.playerHitPoint.x = this.player.position.x + this.player.width / 2;
    this.playerHitPoint.y = this.player.position.y + this.player.height / 2;
    if (this.player.jumpCount !== jumps) this.audio.play('jump');
    this.cameraController.update(this.player.position.x + this.player.width / 2);
    if (this.player.alive) {
      this.checkpoints.update(dt, this.player);
      if (this.player.grounded && this.boss.activate(this.player.position.x)) this.projectiles.clear(false);
      if (this.boss.active) {
        this.collision.constrainHorizontal(this.player, this.boss.arenaLeft, this.boss.position.x - this.player.width);
        this.cameraController.x = this.boss.arenaLeft;
      }
      this.powerups.update(dt, this.player, this.level.solids, this.level.oneWays, levelData.width);
      this.player.updateCombat(dt, this.controls, this.projectiles);
      this.spawner.update(this.cameraController.x);
      this.enemies.update(dt, this.enemyContext, this.cameraController.x);
      this.boss.update(dt, this.enemyContext);
      this.projectiles.update(dt, this.level.solids, levelData.width, this.combat);
      this.combat.updateContacts();
    }
    if (this.projectiles.playerSpawned !== shots) {
      this.audio.play(this.player.weapon.name === 'LASER' ? 'laser' : 'shoot');
      this.playerView.flashMuzzle();
      playerMuzzle(this.player, this.assets, this.muzzlePoint);
      this.fxSprites.spawn(WEAPON_VFX[this.player.weapon.name] ?? 'fx.muzzle.rifle',
        this.muzzlePoint.x, this.muzzlePoint.y, this.muzzlePoint.angle);
    }
    if (this.powerups.collectedCount !== collected) {
      this.audio.play('powerup');
      this.fxSprites.spawn('fx.pickup.collect', this.player.position.x + this.player.width / 2, this.player.position.y + this.player.height / 2);
    }
    if (this.checkpoints.current !== checkpoint) this.audio.play('checkpoint');
    if (this.boss.state === 'TELEGRAPH' && bossState !== 'TELEGRAPH') this.audio.play('bossWarning');
    if (this.combat.playerHits !== playerHits) this.fxSprites.spawn('fx.hit.player', this.playerHitPoint.x, this.playerHitPoint.y);
    if (this.boss.phase !== bossPhase) this.shake.trigger(VFX_SHAKE.boss, VFX_SHAKE.bossTime);
    if (!this.player.alive) {
      this.audio.play('playerDeath');
      this.fxSprites.spawn('fx.explosion.small', this.player.position.x + this.player.width / 2,
        Math.max(8, this.player.position.y + this.player.height / 2));
      this.shake.trigger(VFX_SHAKE.playerDeath, VFX_SHAKE.playerDeathTime);
      this.states.playerDied();
      this.projectiles.clear(false);
      this.powerups.dismissNotice();
      this.checkpoints.dismissNotice();
      this.input.clear();
      this.debugTimer = 0;
    } else {
      if (this.boss.state === 'DEAD') {
        this.audio.play('victory');
        this.states.complete();
        this.projectiles.clear(false);
        this.input.clear();
      }
    }
  }

  private updateDebug(dt: number): void {
    if (this.input.wasPressed('graphicsDebug')) {
      this.graphicsDebugVisible = !this.graphicsDebugVisible;
      this.playerView.setGraphicsDebug(this.graphicsDebugVisible);
      this.fxSprites.setDebug(this.graphicsDebugVisible);
      this.powerupView.setGraphicsDebug(this.graphicsDebugVisible);
      this.bossView.setGraphicsDebug(this.graphicsDebugVisible);
      this.projectileView.setGraphicsDebug(this.graphicsDebugVisible);
      this.levelView.setGraphicsDebug(this.graphicsDebugVisible);
      for (const view of this.enemyViews) view.setGraphicsDebug(this.graphicsDebugVisible);
    }
    if (this.input.wasPressed('debug')) {
      this.debugVisible = !this.debugVisible;
      this.debug.hidden = !this.debugVisible;
      this.playerView.setDebug(this.debugVisible);
      this.levelView.setDebug(this.debugVisible);
      this.bossView.setDebug(this.debugVisible);
      this.projectileView.setDebug(this.debugVisible);
      for (const view of this.enemyViews) view.setDebug(this.debugVisible);
      this.debugTimer = 0;
    }
    this.debugTimer -= dt;
    if (this.debugVisible && this.debugTimer <= 0) {
      const held = actions.filter((action) => this.input.isDown(action)).join(' + ') || '—';
      this.debug.textContent = [
        `FPS ${this.loop.fps} | STEP 60 Hz`,
        `VIRTUAL ${VIEW.width}×${VIEW.height}`,
        `GRAPHICS F2 ${this.graphicsDebugVisible ? 'ON' : 'OFF'} | CYAN bounds | YELLOW anchor | MAGENTA origin`,
        `CAMERA ${this.camera.position.x}, ${this.camera.position.y}`,
        `TICKS ${this.ticks}`,
        `GAME ${this.states.state} | LIVES ${this.states.lives}`,
        `SCORE ${this.score.value} | HIGH ${this.score.highScore}`,
        `CHECKPOINT ${this.checkpoints.current.x}, ${this.checkpoints.current.y}`,
        `INPUT ${held}`,
        `PLAYER ${this.player.position.x.toFixed(1)}, ${this.player.position.y.toFixed(1)}`,
        `VELOCITY ${this.player.velocity.x.toFixed(1)}, ${this.player.velocity.y.toFixed(1)}`,
        `STATE ${this.player.state} | GROUND ${this.player.grounded}`,
        `HEIGHT ${this.player.height} | ONE-WAY ${this.player.onOneWay}`,
        `WEAPON ${this.player.weapon.name} | AIM ${this.player.aimDirection.x.toFixed(2)}, ${this.player.aimDirection.y.toFixed(2)}`,
        `HP ${this.player.health} | INVUL ${this.player.invulnerabilityTimer.toFixed(2)}`,
        `ENEMIES ${this.enemies.activeCount} | PENDING ${this.spawner.pendingEnemies}`,
        `SPAWNS ${this.spawner.triggeredCount}/${this.spawner.groups.length}`,
        `PICKUPS ${this.powerups.collectedCount} | DROPS ${this.powerups.spawnedCount} | ACTIVE ${this.powerups.activeCount}`,
        `BOX STAND ${this.player.standingBounds.width}x${this.player.standingBounds.height} | CROUCH ${this.player.crouchingBounds.width}x${this.player.crouchingBounds.height}`,
        `BOSS ${this.boss.health}/${this.boss.maxHealth} | PHASE ${this.boss.phase} | ${this.boss.state}`,
        `PROJECTILES ${this.projectiles.activeCount}/${this.projectiles.items.length}`,
        `KILLS ${this.combat.kills} | HITS ${this.combat.playerHits}`,
        `SHOTS ${this.projectiles.playerSpawned} | ENEMY SHOTS ${this.projectiles.enemySpawned}`,
        `FIRING ${this.player.shooting}`,
        `PARTICLES ${this.particles.activeCount}/${this.particles.items.length}`,
        `VFX ${this.fxSprites.activeCount}/${this.fxSprites.capacity} | TOTAL ${this.fxSprites.spawnedCount} | SKIPPED ${this.fxSprites.droppedCount}`,
        `SHAKE ${this.shake.offset.x}, ${this.shake.offset.y} | AUDIO ${Math.round(this.audio.volume * 100)}%`,
      ].join('\n');
      this.debugTimer = 0.1;
    }
  }

  private resetRun(): void {
    this.audio.silence();
    this.particles.clear();
    this.fxSprites.clear();
    this.shake.clear();
    this.playerView.resetFeedback();
    this.player.reset(levelData.spawn.x, levelData.spawn.y);
    this.projectiles.clear();
    this.powerups.reset();
    this.checkpoints.reset();
    this.score.reset();
    this.boss.reset();
    for (const view of this.enemyViews) {
      this.scene.remove(view.root);
      view.dispose();
    }
    this.enemyViews.length = 0;
    this.enemies.clear();
    this.spawner.reset();
    this.combat.reset();
    this.cameraController.x = 0;
    this.debugTimer = 0;
  }

  private respawn(): void {
    this.shake.clear();
    this.playerView.resetFeedback();
    const checkpoint = this.checkpoints.current;
    this.player.respawn(checkpoint.x, checkpoint.y);
    this.boss.prepareRespawn();
    this.cameraController.x = 0;
    this.cameraController.update(this.player.position.x + this.player.width / 2);
    if (this.boss.active) this.cameraController.x = this.boss.arenaLeft;
    this.input.clear();
    this.debugTimer = 0;
  }

  private spawnEnemy(placement: EnemyPlacement): void {
    const enemy = this.enemies.spawn(placement);
    const view = new EnemyView(enemy, this.assets, this.onEnemyVisualFire);
    view.setDebug(this.debugVisible);
    view.setGraphicsDebug(this.graphicsDebugVisible);
    this.enemyViews.push(view);
    this.scene.add(view.root);
  }

  private onEnemyKilled(enemy: Enemy | Boss): void {
    this.score.add(SCORE[enemy.kind]);
    if (enemy.kind === 'flying') {
      const drop = this.powerups.dropFromEnemy(enemy);
      if (drop) this.fxSprites.spawn('fx.pickup.drop', drop.x + drop.width / 2, drop.y + drop.height / 2);
    }
    const boss = enemy.kind === 'boss';
    this.fxSprites.spawn(boss || enemy.kind === 'flying' ? 'fx.explosion.medium' : 'fx.explosion.small',
      enemy.position.x + enemy.width / 2, enemy.position.y + enemy.height / 2);
    this.audio.play('enemyDeath');
    if (boss) this.shake.trigger(VFX_SHAKE.boss, VFX_SHAKE.bossTime);
  }

  private onImpact(target: Enemy | Boss | Player | null, x: number, y: number, damaged: boolean): void {
    if (target === this.player && damaged) {
      this.playerHitPoint.x = x; this.playerHitPoint.y = y;
      return;
    }
    this.fxSprites.spawn(target && damaged ? 'fx.hit.enemy' : 'fx.impact.default', x, y);
    if (!target || !('kind' in target)) return;
    this.audio.play(damaged ? target.kind === 'boss' ? 'bossHit' : 'enemyHit' : 'shield');
  }

  private readonly onEnemyVisualFire = (enemy: Enemy): void => {
    enemyMuzzle(enemy, this.assets, this.muzzlePoint);
    this.fxSprites.spawn('fx.muzzle.rifle', this.muzzlePoint.x, this.muzzlePoint.y, this.muzzlePoint.angle);
  };

  private readonly onVolume = (): void => {
    if (this.volumeControl) this.audio.setVolume(Number(this.volumeControl.value));
  };

  private updateHUD(): void {
    this.hud.update(this.states, this.score, this.player, this.checkpoints.current,
      Math.floor(this.player.position.x / levelData.width * 100), this.level.sectionAt(this.player.position.x),
      this.checkpoints.message || this.powerups.message);
    this.menu.update(this.states, this.score, this.checkpoints);
    this.bossHUD.update(this.boss);
  }

  private readonly render = (): void => {
    this.renderer.render(this.scene, this.camera);
  };

  private readonly resize = (): void => {
    const size = getDisplaySize(this.viewport.clientWidth, this.viewport.clientHeight);
    this.renderer.domElement.style.width = `${size.width}px`;
    this.renderer.domElement.style.height = `${size.height}px`;
  };

  private readonly onVisibility = (): void => {
    this.input.clear();
    if (document.hidden) {
      this.audio.silence();
      this.states.pause();
      this.loop.stop();
    }
    else this.loop.start();
  };

  private readonly onBlur = (): void => {
    this.states.pause();
    this.audio.silence();
  };
}
