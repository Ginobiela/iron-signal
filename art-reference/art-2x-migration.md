# Fase 15.5 — contrato de arte 2×

El mundo y la cámara conservan 256×240 unidades. `ART_SCALE = 2` en src/config/art.ts fija únicamente el framebuffer: 512×480, antialias false, pixelRatio 1. NearestFilter y CSS pixelated permanecen activos. El canvas usa escalado entero del framebuffer cuando cabe; en pantallas menores reduce proporcionalmente con letterbox.

La densidad fuente se registra por asset, independientemente del framebuffer. Los 22 clips de Player ya usan frames 64×64 SOURCE y visual 32×32 WORLD; Soldier death también usa 2×. Los demás assets mantienen su densidad registrada y pueden coexistir con estos. `sheet` (frameWidth/Height, margin, spacing, atlas) mide source pixels; `visual` (width/height, offsets, scaleX/Y) mide world units. No se infiere el tamaño visual desde una imagen cargada. `artScale` es 1 o 2; si falta en una definición externa, el visor deriva la densidad horizontal desde frameWidth/visual.width. Con tamaños no uniformes, definir densidad explícita y revisar ambas dimensiones.

Player conserva bottom-center, offsets 0/0 y los FPS/loops existentes. Idle y run usan las nuevas entregas `player_idle_2x (2).png` y `player_run_2x (2).png`. Los aliases genéricos shoot/runShoot/jumpShoot/crouchShoot comparten la textura horizontal correspondiente porque los PNG suministrados son idénticos; los archivos originales se conservan sin modificaciones. El helper playerSprite centraliza el contrato 64 SOURCE → 32 WORLD sin alterar colliders ni muzzles.

## Auditoría y cambios

- assets.ts: el constructor legacy asignaba frame y visual con una misma métrica; ahora declara 1× y admite conversión explícita de metadata mediante withArtScale. No convierte PNG.
- config/vfx.ts y environment.ts: width/height eran ambiguos; quedan documentados como WORLD y admiten artScale por entrada para derivar únicamente source frames. Los props, fallbacks, duración de FX y muzzles conservan su métrica.
- Game.ts: setSize utilizaba VIEW, que también define el frustum. Ahora usa RENDER_VIEW; cámara y gameplay continúan usando VIEW.
- viewport.ts: el fit entero se calcula con el framebuffer, nunca con cámara/posiciones.
- AnimationViewer: su render interno también usa ART_SCALE; preview scale 1×/2×/4×/8× expresa CSS pixels por WORLD unit y no cambia densidad del asset. Tira/hoja son inspecciones de source pixels a 2× de zoom, independientes.
- SpriteVisual, spriteFrames, SpriteAnimator, TiledVisual, ParallaxBackground y los muzzles ya separaban visual/UV/mundo: no se reescribieron.

## Registrar un personaje

Conservar visual y clip, reemplazar path/url cuando exista el PNG real y aplicar la conversión una sola vez en el manifest:

~~~ts
ASSETS['player.idle'] = {
  ...withArtScale(ASSETS['player.idle']!, 2),
  path: 'assets/sprites/player/player_idle_2x.png',
  url: 'assets/sprites/player/player_idle_2x.png',
};
~~~

Un strip de 4 frames será 256×64 SOURCE, con frames 64×64 y visual 32×32 WORLD. Alternativamente registrar sheet y visual explícitos en SpriteAsset. withArtScale preserva visual y clip, escala solo frame/atlas/margin/spacing según la densidad anterior, y no crea texturas. No aplicarlo a cada frame ni automáticamente según ART_SCALE. Las rutas anteriores pueden conservarse si se sustituye el PNG y se actualiza su metadata a la vez.

Para tiles/VFX, agregar artScale: 2 a la entrada en ENVIRONMENT_ASSETS o VFX_EFFECTS cuando exista el PNG nuevo; conservar width/height WORLD, FPS, frames, colores, tiempos y offsets. assets.ts generará source frame = world size × densidad. Ground 32×32 SOURCE ocupa 16×16 WORLD; platform 32×16 SOURCE ocupa 16×8 WORLD; explosion_small 32×32 SOURCE ocupa 16×16 WORLD. Los fondos 512×480 SOURCE cubren 256×240 WORLD y mantienen repeat/multipliers.

## Anchors y muzzles

Bottom-center en 32×32 SOURCE corresponde a (16,32); en 64×64 SOURCE a (32,64), medidos desde arriba/izquierda. Ambos usan el mismo origen WORLD (offsetX, offsetY) en los pies. Center usa el centro de cada frame. Ninguna posición/collider se convierte. Visual.scaleX/Y son ajustes WORLD independientes; flipX solo invierte el plano. PLAYER_MUZZLES y ENEMY_MUZZLES están en WORLD y no se multiplican por ART_SCALE.

## Inventario completo del manifest

Cada fila indica dimensiones POR FRAME. New source es una recomendación de arte externo: no implica que ese PNG exista. Strip horizontal completo = frameWidth × cantidad de celdas, con altura frameHeight; atlas/padding se declaran en source pixels. El estado corresponde al manifest en esta fase.

| Asset ID | PNG | Legacy source | New 2× source | World visual | Estado |
| --- | --- | --- | --- | --- | --- |
| player.idle | assets/sprites/player/player_idle.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.idle_up | assets/sprites/player/player_aim_up.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.idle_diagonal | assets/sprites/player/player_aim_diagonalUp.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.run | assets/sprites/player/player_run.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.jump | assets/sprites/player/player_jump.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.fall | assets/sprites/player/player_fall.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.crouch | assets/sprites/player/player_crouch.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.shoot | assets/sprites/player/player_shoot.png | 32×32 | 64×64 | 32×32 | fallback / previsto 1× |
| player.shoot_horizontal | assets/sprites/player/player_shoot_horizontal.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.shoot_up | assets/sprites/player/player_shoot_up.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.shoot_diagonal | assets/sprites/player/player_shoot_diagonalUp.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.runShoot | assets/sprites/player/player_run_shoot.png | 32×32 | 64×64 | 32×32 | fallback / previsto 1× |
| player.runShoot_horizontal | assets/sprites/player/player_runShoot_horizontal.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.runShoot_up | assets/sprites/player/player_runShoot_up.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.runShoot_diagonal | assets/sprites/player/player_runShoot_diagonalUp.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.jumpShoot | assets/sprites/player/player_jump_shoot.png | 32×32 | 64×64 | 32×32 | fallback / previsto 1× |
| player.jumpShoot_horizontal | assets/sprites/player/player_jumpShoot_horizontal.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.jumpShoot_up | assets/sprites/player/player_jumpShoot_up.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.jumpShoot_diagonal | assets/sprites/player/player_jumpShoot_diagonalUp.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.crouchShoot | assets/sprites/player/player_crouch_shoot.png | 32×32 | 64×64 | 32×32 | fallback / previsto 1× |
| player.crouchShoot_horizontal | assets/sprites/player/player_crouchShoot_horizontal.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| player.death | assets/sprites/player/player_death.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| soldier.idle | assets/sprites/enemies/soldier/soldier_idle.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| soldier.run | assets/sprites/enemies/soldier/soldier_run.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| soldier.shoot | assets/sprites/enemies/soldier/soldier_shoot.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| soldier.death | assets/sprites/enemies/soldier/soldier_death.png | 32×32 | 64×64 | 32×32 | PNG activo 1× |
| runner.run | assets/sprites/enemies/runner/runner_run.png | 24×24 | 48×48 | 24×24 | PNG activo 1× |
| runner.death | assets/sprites/enemies/runner/runner_death.png | 24×24 | 48×48 | 24×24 | PNG activo 1× |
| turret.idle | assets/sprites/enemies/turret/turret_idle.png | 24×24 | 48×48 | 24×24 | PNG activo 1× |
| turret.shoot | assets/sprites/enemies/turret/turret_shoot.png | 24×24 | 48×48 | 24×24 | PNG activo 1× |
| turret.death | assets/sprites/enemies/turret/turret_death.png | 24×24 | 48×48 | 24×24 | PNG activo 1× |
| flying.fly | assets/sprites/enemies/flying/flying_fly.png | 32×24 | 64×48 | 32×24 | PNG activo 1× |
| flying.hit | assets/sprites/enemies/flying/flying_hit.png | 32×24 | 64×48 | 32×24 | PNG activo 1× |
| flying.death | assets/sprites/enemies/flying/flying_death.png | 32×24 | 64×48 | 32×24 | PNG activo 1× |
| flying.carrier.pod | assets/sprites/enemies/flying/flying_carrier_pod.png | 12×10 | 24×20 | 12×10 | PNG activo 1× |
| pickup.M | assets/sprites/weapons/machinegun.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| pickup.S | assets/sprites/weapons/spread.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| pickup.L | assets/sprites/weapons/laser.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| boss.idle | assets/sprites/boss/boss_idle.png | 64×80 | 128×160 | 64×80 | fallback / previsto 1× |
| boss.attack | assets/sprites/boss/boss_attack.png | 64×80 | 128×160 | 64×80 | fallback / previsto 1× |
| boss.damage | assets/sprites/boss/boss_damage.png | 64×80 | 128×160 | 64×80 | fallback / previsto 1× |
| boss.death | assets/sprites/boss/boss_death.png | 64×80 | 128×160 | 64×80 | fallback / previsto 1× |
| projectile.player.bullet | assets/sprites/weapons/rifle.png | 4×4 | 8×8 | 4×4 | fallback / previsto 1× |
| projectile.enemy.bullet | assets/sprites/weapons/enemy_bullet.png | 4×4 | 8×8 | 4×4 | fallback / previsto 1× |
| projectile.player.laser | assets/sprites/weapons/laser_bullet.png | 12×4 | 24×8 | 12×4 | fallback / previsto 1× |
| background.far | assets/environment/background/far/bg_jungle_far.png | 256×240 | 512×480 | 256×240 | fallback / previsto 1× |
| background.mid | assets/environment/background/mid/bg_jungle_mid.png | 256×240 | 512×480 | 256×240 | fallback / previsto 1× |
| background.near | assets/environment/background/near/bg_jungle_near.png | 256×240 | 512×480 | 256×240 | fallback / previsto 1× |
| environment.ground | assets/sprites/environment/ground.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| environment.platform | assets/sprites/environment/platform.png | 16×8 | 32×16 | 16×8 | fallback / previsto 1× |
| environment.edge | assets/sprites/environment/edge.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| environment.vegetationBack | assets/sprites/environment/vegetation_back.png | 32×32 | 64×64 | 32×32 | fallback / previsto 1× |
| environment.vegetationFront | assets/sprites/environment/vegetation_front.png | 32×32 | 64×64 | 32×32 | fallback / previsto 1× |
| environment.decoration | assets/sprites/environment/decoration.png | 32×32 | 64×64 | 32×32 | fallback / previsto 1× |
| fx.muzzle.rifle | assets/sprites/fx/muzzle_rifle.png | 8×8 | 16×16 | 8×8 | PNG activo 1× |
| fx.muzzle.machineGun | assets/sprites/fx/muzzle_machinegun.png | 8×8 | 16×16 | 8×8 | PNG activo 1× |
| fx.muzzle.spread | assets/sprites/fx/muzzle_spread.png | 8×8 | 16×16 | 8×8 | PNG activo 1× |
| fx.muzzle.laser | assets/sprites/fx/muzzle_laser.png | 12×8 | 24×16 | 12×8 | PNG activo 1× |
| fx.hit.enemy | assets/sprites/fx/hit_enemy.png | 8×8 | 16×16 | 8×8 | PNG activo 1× |
| fx.hit.player | assets/sprites/fx/hit_player.png | 8×8 | 16×16 | 8×8 | PNG activo 1× |
| fx.impact.default | assets/sprites/fx/impact_default.png | 8×8 | 16×16 | 8×8 | PNG activo 1× |
| fx.explosion.small | assets/sprites/fx/explosion_small.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| fx.explosion.medium | assets/sprites/fx/explosion_medium.png | 24×24 | 48×48 | 24×24 | PNG activo 1× |
| fx.pickup.drop | assets/sprites/fx/pickup_drop.png | 12×12 | 24×24 | 12×12 | PNG activo 1× |
| fx.pickup.collect | assets/sprites/fx/pickup_collect.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.ground.fill | assets/environment/tiles/jungle/ground_fill.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.ground.top01 | assets/environment/tiles/jungle/ground_top_01.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.ground.top02 | assets/environment/tiles/jungle/ground_top_02.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.ground.top03 | assets/environment/tiles/jungle/ground_top_03.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.ground.left | assets/environment/tiles/jungle/ground_left_edge.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.ground.right | assets/environment/tiles/jungle/ground_right_edge.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.ground.topLeft | assets/environment/tiles/jungle/ground_top_left.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.ground.topRight | assets/environment/tiles/jungle/ground_top_right.png | 16×16 | 32×32 | 16×16 | PNG activo 1× |
| environment.platform.left | assets/environment/tiles/military/platform_metal_left.png | 16×8 | 32×16 | 16×8 | PNG activo 1× |
| environment.platform.middle | assets/environment/tiles/military/platform_metal_middle.png | 16×8 | 32×16 | 16×8 | PNG activo 1× |
| environment.platform.right | assets/environment/tiles/military/platform_metal_right.png | 16×8 | 32×16 | 16×8 | PNG activo 1× |
| environment.platform.single | assets/environment/tiles/military/platform_metal_single.png | 16×8 | 32×16 | 16×8 | PNG activo 1× |
| environment.wall.bunker | assets/environment/tiles/military/bunker_wall.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| environment.wall.concrete | assets/environment/tiles/military/concrete_wall.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| environment.prop.grass | assets/environment/props/jungle/grass.png | 16×8 | 32×16 | 16×8 | fallback / previsto 1× |
| environment.prop.vines | assets/environment/props/jungle/vines.png | 16×32 | 32×64 | 16×32 | fallback / previsto 1× |
| environment.prop.plant | assets/environment/props/jungle/small_plant.png | 24×24 | 48×48 | 24×24 | fallback / previsto 1× |
| environment.prop.rock | assets/environment/props/jungle/rock.png | 16×12 | 32×24 | 16×12 | fallback / previsto 1× |
| environment.prop.branch | assets/environment/props/jungle/foreground_branch.png | 32×12 | 64×24 | 32×12 | fallback / previsto 1× |
| environment.prop.crate | assets/environment/props/military/crate.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| environment.prop.barrel | assets/environment/props/military/barrel.png | 12×20 | 24×40 | 12×20 | fallback / previsto 1× |
| environment.prop.pipe | assets/environment/props/military/pipe.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| environment.prop.barrier | assets/environment/props/military/barrier.png | 32×16 | 64×32 | 32×16 | fallback / previsto 1× |
| environment.prop.sign | assets/environment/props/military/warning_sign.png | 16×24 | 32×48 | 16×24 | fallback / previsto 1× |
| environment.animated.vent | assets/environment/animated/vent_fan.png | 16×16 | 32×32 | 16×16 | fallback / previsto 1× |
| environment.checkpoint.waiting | assets/environment/animated/checkpoint_waiting.png | 16×32 | 32×64 | 16×32 | fallback / previsto 1× |
| environment.checkpoint.active | assets/environment/animated/checkpoint_active.png | 16×32 | 32×64 | 16×32 | fallback / previsto 1× |
| flying.carrier.M | assets/sprites/enemies/flying/flying_carrier_labels.png | 3×5 | 6×10 | 3×5 | PNG activo 1× |
| flying.carrier.S | assets/sprites/enemies/flying/flying_carrier_labels.png | 3×5 | 6×10 | 3×5 | PNG activo 1× |
| flying.carrier.L | assets/sprites/enemies/flying/flying_carrier_labels.png | 3×5 | 6×10 | 3×5 | PNG activo 1× |

## Prioridad de regeneración

1. Player idle (64×64), para aprobar escala/anchor en el viewer antes de otra pose.
2. Player run/crouch y sus variantes de aim/shoot (64×64); preservar baseline y offsets de arma en WORLD.
3. Soldier (64×64), Runner/Turret (48×48), Flying (64×48); mismo tamaño WORLD que ahora.
4. Ground (32×32) y platform (32×16); mismos 16×16/16×8 WORLD, seams compatibles entre todas las piezas.
5. Combat VFX (dimensiones exactas arriba), luego props/fondos.

Los PNG master/referencia no registrados, como soldier-master.png y art-reference/player/source.png, no son assets runtime y no requieren migración. No generar versiones 2× de referencia ni duplicar texturas para flip.

## Validación temporal

Los tests usan metadata/texturas de prueba; la inspección de navegador utiliza una DataTexture sintética TEST / TEMPORARY de 64×64 por frame, asignada únicamente en la sesión de prueba. No redibuja/upscalea al Player ni escribe PNG. Se compara su plano WORLD con Player legacy 32×32 y se prueba su convivencia con Soldier, Runner, tiles y VFX legacy. El arte 2× definitivo todavía debe producirse externamente.

Texturas se cargan una sola vez por URL. Duplicar ambos ejes implica 4× texels únicamente para las fuentes migradas. Cambiar framebuffer no multiplica texturas existentes. renderer.info ofrece calls, geometries y textures; no bytes reales de VRAM.

## Mediciones y regresiones

Chrome local, mismo tramo inicial y fixture: antes/después 60 FPS, 83 draw calls,
32 geometrías y 12 texturas subidas a GPU. En estrés: 60 FPS, 224 geometrías,
32 texturas estables después de calentar pools, 253 FX emitidos y cero descartes.
Estos conteos no son bytes de VRAM ni una garantía para todos los dispositivos.
Los PNG actuales no cambiaron; el framebuffer duplica ambos ejes (4× píxeles),
con memoria de buffers superior aunque la memoria de fuentes legacy siga igual.

Recorrido real hasta x=1021: 60 FPS, tres vidas, misma geometría de nivel.
Se verificaron cuatro aspect ratios con framebuffer 512×480, parallax, plataformas,
foso, caída/recogida/expiración M/S/L, score, checkpoints, respawn, game over y boss.
Torreta real: alto de pie HIT, alto agachado MISS, bajo agachado HIT.
La textura sintética temporal 64×64 ocupa exactamente el mismo plano de 32×32
WORLD que el legacy; no desplaza collider, anchor, origin ni flip.
251 tests, typecheck y build pasan; no hay script lint.
