# Fase 14: reconciliación y contrato de VFX

## Fase 15.5 — arte 2×, mismos efectos WORLD

Las dimensiones de las tablas siguientes son **LEGACY 1×** y siguen vigentes para
los PNG integrados. Para arte nuevo **2×**, duplicar únicamente frame SOURCE:
8×8 → 16×16, 12×8 → 24×16, 16×16 → 32×32, 24×24 → 48×48,
12×12 → 24×24. `VfxConfig.width/height` permanecen WORLD; agregar `artScale: 2`
cuando exista el PNG. Manifest deriva source frames, pero duración, FPS, pool,
eventos, tamaños visuales y muzzles siguen iguales. Los muzzles se miden en WORLD.
Framebuffer 512×480, cámara 256×240, NearestFilter, antialias false, pixelRatio 1.
No convertir PNG automáticamente ni duplicar texturas por instancia.
Inventario/registro: [art-2x-migration.md](art-2x-migration.md).

## Estado real encontrado

El pipeline de Fase 11 ya estaba implementado y las siguientes integraciones
de Player/enemigos también existían en código. Se comprobaron 34 entradas activas
del manifest, con PNG presentes y carga correcta. No se rehicieron vistas ni AI.

- Player: idle, run, crouch, jump, fall, aim up/diagonal, shoot horizontal/up/diagonal,
  runShoot horizontal/up/diagonal, jumpShoot horizontal/up/diagonal,
  crouchShoot horizontal y death: 18 PNG activos.
- Soldier: idle/run/shoot/death. Runner: run/death. Turret: idle/shoot/death.
- FlyingEnemy: fly/hit/death y cápsula/etiquetas M/S/L. La tira de tres etiquetas
  comparte una textura, registrada con tres clips.
- soldier-master.png es referencia conservada; no se carga en ejecución.
- No había PNG pendientes de registrar. Boss, entorno, fondos, proyectiles y
  pickups de suelo mantienen sus placeholders por falta de arte.
- Poses Player sin dibujo específico (por ejemplo jump/fall apuntando arriba
  sin disparar o crouch apuntando arriba) conservan el fallback orientable.
- Al comenzar la Fase 14 no había PNG de VFX. El pool anterior no dibujaba nada si faltaba una textura;
  el flash geométrico del Player quedaba oculto con un rifle incluido en el sprite.

## Arquitectura final

FxSpritePool sigue siendo el único pool de efectos: 24 slots preasignados, cada uno
con SpriteVisual y tres quads de fallback. Geometría de quads y material del punto
central compartidos. No crea texturas, materiales ni meshes por disparo/impacto.
Se conservan los 192 elementos del ParticleManager, renderizados por instancing.
Saturación descarta únicamente efectos visuales y se cuenta en F1.

`src/config/vfx.ts` centraliza tamaños, frames, FPS, duración (frames/FPS), colores,
partículas, offsets del muzzle, activación de PNG y shake. `assets.ts` deriva el
manifest, siempre con anchor center y non-loop. Añadir `enabled: true` al efecto
en VFX_EFFECTS cuando su PNG exista; carga centralizada y fallback si falla.

Game observa el contador de disparos exitosos del jugador: un evento visual por
disparo, incluso cuando Spread emite cinco proyectiles. EnemyView observa el reset
del attackTimer de Soldier/Turret, después del disparo de la AI. FlyingEnemy no
dispara en el gameplay actual. Ningún callback de animación genera balas.

CombatSystem ya entrega el punto barrido del impacto; se reutiliza para sparks.
Los contactos se detectan por el contador de golpes del Player y tienen fallback
en el centro de su collider. Muerte/drop/pickup/respawn conservan sus tiempos y
condiciones. Drop ocurre inmediatamente; no espera a death/explosion.

Los muzzles de sprites usan offsets relativos al origen visual, con flip y pose;
los placeholders conservan el cañón geométrico. No cambian projectile origins.
Los cañones enemigos dibujados horizontalmente mantienen su punta visual,
mientras los proyectiles siguen el aimDirection real. Ajustar offsets aquí si
un sprite nuevo cambia la punta del arma, nunca en Player/Weapon.

Duraciones: muzzle 66,7 ms, hit 100 ms, impacto 83,3 ms, explosiones 200/300 ms,
drop 150 ms, collect 250 ms. Las partículas acompañantes no duran más que el efecto.
Cada slot vuelve al pool al terminar su duración/clip; dt=0 congela efectos en pausa.

Capas: DRAW.fxBehind=2,8 detrás de entidades; DRAW.fx=5 delante de proyectiles.
F1: activos/capacidad/total/descartados. F2: bounds y anchor/origin de efectos activos.
Las cruces centrales de debug también permiten inspeccionar el muzzle.

Shake: impactos, hits, pickups y explosiones pequeñas=0; FlyingEnemy=1 durante
0,1 s; Player death=1,5 durante 0,16 s; boss=2 durante 0,3 s. Se conservan límite
de dos píxeles, decay y prefers-reduced-motion. No se introduce hit-stop.

## PNG integrados

Los 11 PNG están integrados bajo **public/assets/sprites/fx/**. PNG RGBA, alpha binario 0/255,
strip horizontal, celdas uniformes sin trimming, sin blur, sin gradients.
En estos PNG legacy 1×, un píxel fuente equivale a una unidad WORLD; en nuevos 2×,
dos píxeles fuente equivalen a una unidad WORLD. No dibujar cuadrícula ni etiquetas.
Para muzzles, dirección original RIGHT; el sistema rota el efecto según apuntado.
Mantener el origen en el centro de cada celda. Padding opcional debe declararse.

| Archivo | Frame | Frames | PNG completo | FPS | Loop | Anchor |
| --- | --- | --- | --- | --- | --- | --- |
| muzzle_rifle.png | 8×8 | 2 | 16×8 | 30 | no | center |
| muzzle_machinegun.png | 8×8 | 2 | 16×8 | 30 | no | center |
| muzzle_spread.png | 8×8 | 2 | 16×8 | 30 | no | center |
| muzzle_laser.png | 12×8 | 2 | 24×8 | 30 | no | center |
| hit_enemy.png | 8×8 | 3 | 24×8 | 30 | no | center |
| hit_player.png | 8×8 | 3 | 24×8 | 30 | no | center |
| impact_default.png | 8×8 | 2 | 16×8 | 24 | no | center |
| explosion_small.png | 16×16 | 4 | 64×16 | 20 | no | center |
| explosion_medium.png | 24×24 | 6 | 144×24 | 20 | no | center |
| pickup_drop.png | 12×12 | 3 | 36×12 | 20 | no | center |
| pickup_collect.png | 16×16 | 4 | 64×16 | 16 | no | center |

Soldier/Turret reutilizan muzzle_rifle; Player death reutiliza el burst pequeño
y su animación ya integrada. No se requiere otro PNG para estos eventos.

## Validación

Tests del pool: reutilización, saturación, pausa, expiración y clear, non-loop con
textura, fallback ante carga fallida, duración acotada, shake y origen visual
independiente. Los tests anteriores mantienen drops únicos y regresiones de gameplay.
Pruebas en navegador cubren armas, muzzles, impactos, muerte/drop/collect,
invulnerabilidad, respawn, boss, score, checkpoints, pausa y game over.
Medir memoria GPU tras calentar los pools: Three.js sube geometrías preasignadas
solo cuando se dibujan por primera vez, especialmente con F2 activo.

Validación final: 230 tests pasan, typecheck y build correctos; no hay script lint.
Prueba automatizada en Chrome: Machine Gun sostenida a 60 FPS; estrés con cinco
Soldiers, tres FlyingEnemies, Turret e impactos/explosiones simultáneos a 60 FPS,
253 efectos emitidos, cero descartes y memoria GPU estable tras el calentamiento.
Son mediciones locales de esta prueba, no una garantía para todos los dispositivos.
