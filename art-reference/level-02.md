# Fase 19 — Nexo Subterráneo

## Jugar y editar

Menú → **LEVEL 2 · NEXO SUBTERRÁNEO**, o `/?level=levels/level-02.json`. No requiere developer mode. Boss Run conserva el nivel seleccionado. Level Editor → seleccionar Level 2 → LOAD → PLAY FROM START / HERE. Gameplay Tuner → PLAYTEST LEVEL 2.

`public/levels/level-02.json` es la fuente editable; no existe Level2.ts. Schema v1 mantiene compatibilidad mediante campos opcionales `environmentSkin`, `pickups` y `boss.encounter`. No cambian los datos ni el balance del Level 1.

## Estructura

| Tramo world X | Función |
|---|---|
| 0–512 | Entrada, combate liviano, primeras pasarelas |
| 512–1792 | Base interior; Soldiers, Runners, Turret, FlyingEnemy, pickup M |
| 1792–2560 | Núcleo industrial, alturas, segundo volador portador L |
| 2560–3456 | Corredor continuo reutilizado durante la retirada |
| 3456–3680 | Preparación, pickup S, checkpoint en 3616 |
| 3680–3808 | Trigger y bloqueo del avance; mecha aparece en 3840 |
| 3680 → 2560 | Persecución hacia la izquierda |
| ≤2592 | Ascensor de extracción, habilitado al derrotar al mecha |

Ancho 4096 frente a 9600 del Level 1. Ida + retirada hasta salida ≈4770 world units, ~50% de la distancia del Level 1. No es una medición de duración de una partida humana: combate y reintentos influyen. Dos checkpoints: 1536 y 3616. Catorce plataformas one-way forman escalones de hasta 32 world units; no se alteró el salto para acomodarlas. Dos gaps de 48 unidades están fuera del corredor de retirada.

## Encuentro reusable

```json
"boss": {
  "id": "boss", "x": 3840, "y": 44, "arenaLeft": 3680,
  "encounter": { "type": "pursuit", "retreatLeft": 2560,
    "barrierX": 3808, "cameraAnchor": 0.2 }
}
```

`arenaLeft` conserva el significado de trigger, no de límite izquierdo de la persecución. Sin `encounter` se crea el boss de arena original. Con este descriptor se crea `PursuitBoss`, subclase del mismo Boss que ya usa CombatSystem, score, HUD y VFX. No se consulta el ID del nivel para decidir comportamiento.

INTRO → CHASE → DEAD. El boss avanza incluso durante el aviso de introducción, pero no dispara ni recibe daño durante INTRO. Durante CHASE es vulnerable continuamente, se desplaza hacia la izquierda y dispara un misil por cooldown. La velocidad está limitada al 95% de la velocidad configurada del Player; si queda lejos, el ajuste suave de presión también respeta ese límite. Se detiene al llegar a retreatLeft + 100. No teletransporta al jugador ni al boss durante el encuentro.

`PursuitSequence` aplica los límites declarativos, el encuadre horizontal y **backpedal automático**: después del movimiento, el Player mira al boss y puede correr hacia la izquierda mientras dispara a la derecha. Las diagonales verticales también se orientan hacia la amenaza. No cambia bindings, velocidad, salto, colliders ni el apuntado fuera del encuentro. La cámara conserva al jugador dentro del encuadre y muestra parte del boss cuando la separación lo permite; nunca aplica escala a world coordinates.

La compuerta roja indica el límite de avance. Tras la muerte, desaparece el bloqueo, el ascensor cambia a verde y aparece la indicación de salida a la izquierda. El nivel se completa solo con boss muerto + Player vivo, en suelo y X ≤ exitX; en campaña continúa automáticamente a Level 3 por nextLevel. Matar al boss lejos de la salida no completa inmediatamente el nivel.

Si el Player muere durante el chase: se limpian proyectiles, el checkpoint se conserva, el mecha vivo vuelve a DORMANT con HP completo y se reactiva al volver a cruzar el trigger. Pickups declarados vuelven a estar disponibles al acercarse. Si el boss ya estaba muerto, permanece muerto durante el respawn; no se puede cobrar su score otra vez. Un nuevo run sí reinicia todo.

## Misiles y tuning

El mismo pool de **96 Projectile** maneja bullets, laser y missile. `spawnHoming` no crea objetos. `turnRate` es radianes/segundo; el delta angular se limita a turnRate × dt y la magnitud de velocidad se conserva. El target es el centro del Player. Se usa el sweep de CombatSystem contra Player y sólidos; las plataformas one-way se atraviesan como con las balas existentes. La vida es finita y toda retirada normal del misil genera `fx.explosion.small`; limpiar el pool por respawn/muerte del boss no genera explosiones espurias. La muerte del boss limpia ataques inmediatamente.

Gameplay Tuner → **MECHA PURSUIT**:

| Parámetro | Default | Aplicación |
|---|---:|---|
| health | 60 | RESTART; HP nuevo al reintentar/crear el boss |
| chaseSpeed | 90 world/s | LIVE, tope adicional 95% Player speed |
| introTime | 1.4 s | Próxima activación |
| missileCooldown | 1.5 s | Próximo cooldown |
| missileSpeed | 160 world/s | Misiles nuevos |
| missileTurnRate | 1.15 rad/s | Misiles nuevos |
| missileLifetime | 3.5 s | Misiles nuevos |
| missileDamage | 1 | Misiles nuevos |

Los defaults específicos viven en `config/mecha.ts`, se incorporan al mismo GameplayConfigStore y no reemplazan `boss.health = 100` ni otros defaults existentes.

## Editor

Seleccionar BOSS permite editar x/y del spawn, arenaLeft del trigger y cambiar arena/pursuit. El modo pursuit muestra retreatLeft, barrierX y cameraAnchor; la salida se edita mediante exitX en Level/World. El overlay dibuja corredor, compuerta, spawn y salida. Todos participan en export/import y undo/redo. Los pickups se seleccionan, arrastran, duplican, eliminan y editan (kind M/S/L); ADD WEAPON PICKUP crea uno adicional. environmentSkin selecciona legacy/underground. No se introduce otro editor ni renderer.

## Arte externo integrado — contrato de los 25 PNG

**Los 25 PNG de underground/mecha están presentes y activos en el manifest.** Se verificaron dimensiones reales, PNG RGBA y alpha binario (0/255; tiles y FAR opacos). Se conserva el fallback por fallo de carga. No se generaron ni reescalaron imágenes; source 2× mantiene los tamaños world y colliders originales.

Todos: PNG RGBA, pixel art, NearestFilter, alpha binario. Las dimensiones de frame son **source 2×**; world size es la mitad. Spritesheets horizontales. Base RIGHT para mecha/misil; flipX o rotación del renderer determina orientación. Todos los tiles estáticos tienen 1 frame, 1 FPS y loop=true (repite el único frame, sin movimiento).

`public/assets/environment/tiles/underground/`:

| Filename | Source frame | World | Anchor | Layer | Repetición |
|---|---|---|---|---|---|
| ground_future_fill.png | 32×32 | 16×16 | bottom-center | LEVEL_TILES 1.2 | XY |
| ground_future_top_01.png | 32×32 | 16×16 | bottom-center | LEVEL_TILES 1.2 | X |
| ground_future_top_02.png | 32×32 | 16×16 | bottom-center | LEVEL_TILES 1.2 | X |
| ground_future_top_03.png | 32×32 | 16×16 | bottom-center | LEVEL_TILES 1.2 | X |
| ground_future_left_edge.png | 32×32 | 16×16 | bottom-center | LEVEL_TILES 1.2 | Y |
| ground_future_right_edge.png | 32×32 | 16×16 | bottom-center | LEVEL_TILES 1.2 | Y |
| ground_future_top_left.png | 32×32 | 16×16 | bottom-center | LEVEL_TILES 1.2 | no |
| ground_future_top_right.png | 32×32 | 16×16 | bottom-center | LEVEL_TILES 1.2 | no |
| platform_metal_left.png | 32×16 | 16×8 | bottom-center | LEVEL_TILES 1.2 | no |
| platform_metal_middle.png | 32×16 | 16×8 | bottom-center | LEVEL_TILES 1.2 | X |
| platform_metal_right.png | 32×16 | 16×8 | bottom-center | LEVEL_TILES 1.2 | no |
| platform_metal_single.png | 32×16 | 16×8 | bottom-center | LEVEL_TILES 1.2 | no |

IDs: `environment.underground.ground.{fill,top01,top02,top03,left,right,topLeft,topRight}` y `environment.underground.platform.{left,middle,right,single}`. Las variantes top usan la misma función determinista tileVariant del Level 1.

`public/assets/environment/props/underground/` (1 frame, 1 FPS, loop=true):

| Filename | Source frame | World | Anchor | Layer | Repetición |
|---|---|---|---|---|---|
| panel_wall.png | 32×32 | 16×16 | bottom-center | LEVEL_BACK_DECOR -0.5 | XY |
| prop_pipe_large.png | 64×96 | 32×48 | bottom-center | LEVEL_BACK_DECOR -0.5 | no |
| prop_console.png | 64×48 | 32×24 | bottom-center | LEVEL_BACK_DECOR -0.5 | no |
| prop_gate.png | 96×160 | 48×80 | bottom-center | LEVEL_BACK_DECOR -0.5 | no |

IDs: `environment.underground.wall.panel` y `environment.underground.prop.{pipe,console,gate}`. La compuerta decorativa no aporta collider; el límite de encuentro es independiente.

`public/assets/environment/background/underground/` (1 frame, 1 FPS, loop=true, center anchor, world 256×240, repetibles X):

| Filename | Source frame | Layer | Parallax |
|---|---|---|---:|
| bg_underground_far.png | 512×480 | BACKGROUND_FAR -6 | 0.15 |
| bg_underground_mid.png | 512×480 | BACKGROUND_MID -4 | 0.40 |
| bg_underground_near.png | 512×480 | BACKGROUND_NEAR -2 | 0.75 |

IDs `background.underground.{far,mid,near}`. Fondo de bajo contraste, cavernas y siluetas industriales; sin sol ni cielo abierto. MID/NEAR con transparencia para mantener composición y legibilidad.

`public/assets/sprites/boss/mecha/`:

| Filename | Source frame | Frames | FPS | Loop | World | Anchor / layer |
|---|---|---:|---:|---|---|---|
| boss_mecha_idle.png | 128×160 | 4 | 6 | sí | 64×80 | bottom-center / ENTITIES 3 |
| boss_mecha_move.png | 128×160 | 6 | 10 | sí | 64×80 | bottom-center / ENTITIES 3 |
| boss_mecha_fire.png | 128×160 | 3 | 12 | no | 64×80 | bottom-center / ENTITIES 3 |
| boss_mecha_damage.png | 128×160 | 2 | 12 | no | 64×80 | bottom-center / ENTITIES 3 |
| boss_mecha_death.png | 128×160 | 6 | 10 | no | 64×80 | bottom-center / ENTITIES 3 |
| boss_missile.png | 24×12 | 2 | 12 | sí | 12×6 | center / PROJECTILES 4 |

IDs `boss.mecha.{idle,move,fire,damage,death}`, `projectile.enemy.missile`. El collider mecha conserva 56×72 world units. Idle, movimiento, daño y muerte seleccionan sus clips; cada misil lanzado correctamente incrementa un contador visual observado por BossView para reproducir fire durante los 3 frames. La animación no controla ataques ni cooldowns. Hit flash usa tint sobre el mismo material. El mecha base RIGHT usa flipX y el misil rota según su velocidad.

No se necesitan nuevos PNG VFX obligatorios: explosión de misil y spawn/death reutilizan `fx.explosion.small/medium`, aviso usa sonido/HUD/shake existentes. Si luego se requieren variantes: `boss_missile_explosion.png` (32×32, 5 frames, 20 FPS, no-loop, center, FX 5), `warning_alarm.png` (32×32, 2 frames, 8 FPS, loop, center, LEVEL_BACK_DECOR), `homing_missile_trail.png` (16×8, 3 frames, 20 FPS, no-loop, center, FX_BEHIND). Son propuestas futuras, no assets obligatorios ni registrados por ahora.

## Validación y límites

- `tests/level2.test.ts`: Luna, parsing/schema, trigger/intro/chase, speed cap, muerte/reset, steering/lifetime/reutilización.
- `tests/pursuit-sequence.test.ts`: integración de facing, límites/cámara/salida, checkpoint, colisión de misiles, editor/undo/export.
- `scripts/level2-check.cjs`: Chrome con juego real, recorre mapa y gaps, mata enemigos, recoge dos pickups, activa chase/misiles, provoca muerte, verifica checkpoint/reintento, derrota por proyectiles y extrae; carga Level 2 en editor sin errores. Fixtures protegidas con invulnerabilidad para traversal/defeat; **no** certifica dificultad ni prueba humana completa sin protección.
- Tests previos de Level 1, weapons, physics, controls y herramientas se mantienen. El pool de proyectiles sigue siendo 96; las nuevas texturas se comparten mediante AssetManager.
- Validación con arte integrado: 344 tests / 25 archivos, typecheck y build release correctos. El test visual del mecha verifica fire/move/death y que el viewer no genere proyectiles. `level2-check.cjs` verifica los 25 PNG cargados, dimensiones de sheets, NearestFilter y el flujo completo del nivel.
- Muestreo Chrome headless local a 1100×900: persecución con arte integrado 60 FPS / 55 draw calls / 21 texturas residentes. Como referencia anterior con fallbacks: 60 FPS / 74 calls / 9 texturas. Son escenas muestreadas con carga lazy; no representan un benchmark universal ni una medición de bytes GPU. Requiere revisión en dispositivos reales. Capturas de entrada/persecución sin huecos visibles en suelo y plataformas; Player/mecha legibles sobre los fondos.
- Persecución pensada para corredor horizontal continuo. Boss no tiene pathfinding vertical ni navegación de pits; futuros mapas deben respetar ese contrato o extenderlo explícitamente.
- La duración objetivo y dificultad deben ajustarse con partidas reales. Si el Player se separa más de una pantalla, no es posible mostrar ambos completos; la cámara prioriza al jugador y el boss vuelve a verse al llegar al extremo del corredor.
- No faltan PNG obligatorios de esta entrega. Trail y explosión específicos del misil siguen siendo opcionales; se reutiliza el VFX existente. No se avanza a Level 3.

## Archivos

Creados: `public/levels/level-02.json`, `src/bosses/PursuitBoss.ts`, `src/config/mecha.ts`, `src/level/PursuitSequence.ts`, `tests/level2.test.ts`, `tests/pursuit-sequence.test.ts`, `scripts/level2-check.cjs`, este documento.

Modificados: `Boss.ts`, `assets.ts`, `gameplay.ts`, `Game.ts`, `Level.ts`, `LevelDocument.ts`, `Projectile.ts`, `ProjectileManager.ts`, `ProjectileView.ts`, `BossView.ts`, `BossHUD.ts`, `EnvironmentView.ts`, `LevelView.ts`, `ParallaxBackground.ts`, `Menu.ts`, `style.css`, `GameplayTuner.ts`, `LevelEditor.ts`, `levelEditorModel.ts`, `animationViewerRegistry.ts`, `level-editor.html`, `README.md`.
