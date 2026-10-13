# Fase 20 — Torre Bastión

## Jugar, editar y alcance

Menú → LEVEL 3 · TORRE BASTIÓN, o `/?level=levels/level-03.json`. Level Editor → Level 3 → LOAD; FIT LEVEL muestra el mundo completo. CAMERA mueve el preview de 256×240; CAMERA-ZONE dibuja una zona rectangular. PLAY FROM HERE conserva la altura del preview. Gameplay Tuner incluye PLAYTEST LEVEL 3.

La campaña ahora conecta Level 1 → Level 2 → Level 3 mediante `nextLevel`. Level 3 no declara otro nivel. Playtests/editor/tuner permanecen independientes. No se implementó Level 4.

## Auditoría y compatibilidad

Se encontraron dependencias X-only en CameraController, EnemySpawner, checkpoints, visuales de checkpoints, progreso/secciones, activación/retiro de enemigos y editor. La validación fijaba height=240; proyectiles desaparecían por encima de Y=272; parallax solo reaccionaba a X. Colisiones y movimiento ya eran 2D y se reutilizaron.

Schema v1 se amplía con campos opcionales, sin migrar manualmente la geometría anterior:

- `height`: 240–10000. Legacy LevelData sin height conserva 240.
- `cameraZones`: rectángulos `{id,x,y,width,height,mode,transitionDuration?}`. Modos `HORIZONTAL_FOLLOW`, `VERTICAL_FOLLOW`, `LOCKED`; no se añadió FREE_FOLLOW porque no se necesita.
- `spawnGroups`: mantienen `{id,x,enemies}` legacy. Si incluyen `y,width,height`, se activan por overlap del Player, no por cameraX. Cada trigger se ejecuta una vez por intento.
- `checkpoints`: mantienen el umbral X legacy. Los nuevos usan `{id,x,y,name,order,area}`. `order` define progreso incluso si el recorrido regresa a menor X. Las banderas usan ese orden.
- `sections[].area`, `exitArea`, `killZones`: rectángulos X/Y. No hay muerte automática por cameraY.
- Boss `kind:'gate'`, `arena` y `trigger`: posición, límites y activación declarativos. El ID del nivel no controla el comportamiento.

Checkpoint guarda un snapshot de triggers 2D; respawn restaura oleadas posteriores y rearma el área del checkpoint. Legacy conserva el reset desde la cámara del checkpoint. Se limpian instancias/visuals anteriores, proyectiles y pickups. Gate reset restaura torretas, puerta y compuertas; se eliminan perros residuales.

La cámara mantiene deadzone horizontal anterior en Levels 1/2. En vertical, Player queda entre aproximadamente 42–58% de altura; deadzone 20, límite de seguimiento 600 world/s y transición 0.35 s. El encuadre protege al Player durante cambios y respawn elevado hace un snap explícito al checkpoint. Bounds X/Y respetan world y viewport. Parallax repite en ambos ejes con objetos construidos al cargar, sin meshes por frame.

## Diseño de Level 3

Mundo **2048×1600**, viewport lógico **256×240**, framebuffer **512×480**. No cambian velocidad, gravedad, salto, armas ni colliders del Player.

| Sección | Recorrido | Cámara |
|---|---|---|
| Entrada | X 0–640, pies Y 44 | Horizontal |
| Primer ascenso | X 416/528, Y 44→556; 16 escalones | Vertical |
| Pasarela intermedia | X 624→1120, pies Y 556; gap de 32 y pickup M | Horizontal |
| Ascenso principal | X 1120/1232, Y 556→1356; 25 escalones | Vertical |
| Puente superior | X 1120→1792, pies Y 1356; pickup L y checkpoint | Horizontal |
| Arena Bastión | X 1792–2048, origen de cámara Y 1328 | Locked |

Los 41 escalones tienen subida de 32, ancho 96 y desplazamiento lateral 112. Se puede preparar el salto en el borde; no se exige saltar 112 unidades desde el centro. Las conexiones superiores usan one-way para evitar bloquear el ascenso con un techo sólido. Hay dos plataformas extra de combate en la arena y dos pasarelas de conexión (45 one-way en total).

Checkpoints: (400,44), (640,556), (1232,1004), (1744,1356). Kill zones explícitas: laterales de pozos y fondo del pequeño gap del corredor, representados en rojo en fallback. No cambian las colisiones del terreno.

La duración comparable a Level 1 necesita partidas humanas; la prueba guiada confirma accesibilidad con el salto actual, no dificultad ni tiempos de una partida normal.

## Robot Dog y Fortified Gate

RobotDog es un Enemy normal, bajo (18×10 collider), corre hacia Player dentro de activationDistance y salta obstáculos cuando queda bloqueado. ContactDamage configurable; no arma nueva. Se reutilizan movimiento, colisiones, score, health y hit flash. Enemy Palette lo incluye y Animation Viewer descubre sus clips desde manifest.

FortifiedGateBoss reutiliza Boss y CombatSystem. `damageTargets` contiene dos GateTurret independientes y puerta central, sin duplicar enemigos en EnemyManager. Torretas tienen sus propias HP, apuntado y cooldown; ambas deben morir antes de vulnerar la puerta. Las compuertas son estados/timers de gameplay, independientes de animación:

1. Fase 1: dos torretas activas, puerta blindada.
2. Fase 2: torretas destruidas, puerta vulnerable, hatches alternan CLOSED → OPENING (0.3 s) → OPEN (0.4 s) → CLOSING (0.3 s) → cooldown.
3. Fase 3: HP de puerta ≤35%; cooldown de hatches ×0.6.

El spawn ocurre al entrar en OPEN y comprueba el límite de perros activos pertenecientes al boss; los colocados en otros sectores no bloquean hatches. Los perros muertos y sus visuales se reciclan para evitar acumulación indefinida de instancias durante oleadas. Defaults: puerta 80 HP, torretas 12 HP cada una, disparo cada 1.4 s a 120 world/s, hatchCooldown 2.4 s, máximo 3 perros. Al morir puerta: stop spawns, torretas desactivadas, proyectiles limpios, perros desactivados, explosión existente y acceso libre. Entrar en `exitArea` completa Level 3. El checkpoint previo reinicia todo si el Player muere.

Tuner añade CAMERA (`verticalDeadzone`, `verticalFollowSpeed`, `cameraTransitionDuration`), ROBOT DOG (`health`, `speed`, `contactDamage`, `activationDistance`, `jumpSpeed`, `spawnCooldown`) y FORTIFIED GATE (`mainHealth`, `turretHealth`, `turretFireCooldown`, `turretBulletSpeed`, `hatchCooldown`, `maxActiveDogs`). HP al recrear/reiniciar; velocidad/timing afectan updates o eventos nuevos. Defaults de Levels 1/2 no cambiaron.

## Contrato externo — 31 PNG pendientes

**No se generó arte.** Todos estos IDs están preparados sin URL y muestran fallback. Tras producir PNG que coincidan con las dimensiones, activar sus URL en `src/config/assets.ts`. Source es 2× world; alpha binario, NearestFilter, sin smoothing, spritesheets horizontales. No cambiar colliders para acomodar dibujos.

### Tiles: `public/assets/environment/tiles/tower/`

Todos 1 frame, 1 FPS, loop=true (único frame), anchor bottom-center, capa LEVEL_TILES=1.2.

| Archivo | Source frame | World | Repetición prevista |
|---|---|---|---|
| ground_tower_fill.png | 32×32 | 16×16 | XY |
| ground_tower_top_01.png | 32×32 | 16×16 | X |
| ground_tower_top_02.png | 32×32 | 16×16 | X |
| ground_tower_top_03.png | 32×32 | 16×16 | X |
| ground_tower_left_edge.png | 32×32 | 16×16 | Y |
| ground_tower_right_edge.png | 32×32 | 16×16 | Y |
| ground_tower_top_left.png | 32×32 | 16×16 | no |
| ground_tower_top_right.png | 32×32 | 16×16 | no |
| platform_metal_left.png | 32×16 | 16×8 | no |
| platform_metal_middle.png | 32×16 | 16×8 | X |
| platform_metal_right.png | 32×16 | 16×8 | no |
| platform_metal_single.png | 32×16 | 16×8 | no |

IDs `environment.tower.ground.{fill,top01,top02,top03,left,right,topLeft,topRight}`, `environment.tower.platform.{left,middle,right,single}`. Variantes deterministas existentes; no alterar dibujo durante scroll. Metal industrial oscuro, ribetes legibles, sin parecer pickups/enemigos.

### Props: `public/assets/environment/props/tower/`

1 frame, 1 FPS, loop=true, bottom-center, LEVEL_BACK_DECOR=-0.5.

| Archivo | Source frame | World | Tileable |
|---|---|---|---|
| panel_wall.png | 32×32 | 16×16 | XY |
| prop_pipe_large.png | 64×96 | 32×48 | no |
| prop_console.png | 64×48 | 32×24 | no |
| prop_gate.png | 96×160 | 48×80 | no |

IDs `environment.tower.wall.panel`, `environment.tower.prop.{pipe,console,gate}`. Props son decorativos; el boss es un asset aparte.

### Background: `public/assets/environment/background/tower/`

1 frame, 1 FPS, loop=true, center, world 256×240. **Repetibles X e Y**, sin seams en los cuatro bordes.

| Archivo | Source frame | Layer | Factor XY |
|---|---|---|---:|
| bg_tower_far.png | 512×480 | BACKGROUND_FAR=-6 | 0.15 |
| bg_tower_mid.png | 512×480 | BACKGROUND_MID=-4 | 0.40 |
| bg_tower_near.png | 512×480 | BACKGROUND_NEAR=-2 | 0.75 |

IDs `background.tower.{far,mid,near}`. Estructura vertical, reactor y maquinaria con contraste inferior al gameplay; MID/NEAR transparentes.

### Animated: `public/assets/environment/animated/tower/`

| Archivo | Source frame | World | Frames | FPS | Loop | Anchor | Layer |
|---|---|---|---:|---:|---|---|---|
| warning_light.png | 32×32 | 16×16 | 4 | 6 | sí | bottom-center | LEVEL_BACK_DECOR=-0.5 |

ID `environment.tower.animated.light`; decoración sin gameplay.

### Robot Dog: `public/assets/sprites/enemies/robotDog/`

Base RIGHT, flipX para LEFT, bottom-center, world 24×16, ENTITIES=3. Collider 18×10; no rifle ni detalles que sugieran disparo.

| Archivo | Source frame | Frames | FPS | Loop |
|---|---|---:|---:|---|
| robot_dog_run.png | 48×32 | 6 | 12 | sí |
| robot_dog_attack.png | 48×32 | 2 | 12 | sí |
| robot_dog_death.png | 48×32 | 5 | 10 | no |

IDs `robotDog.{run,attack,death}`. Silueta mecánica baja y carrera clara; attack refleja cercanía/contacto sin controlar daño.

### Boss: `public/assets/sprites/boss/gate/`

Todas bottom-center, ENTITIES=3. Puerta fija orientada al frente; torretas base RIGHT usando facing/flipX; no integrar las torretas destructibles dentro del PNG central.

| Archivo | Source frame | World | Frames | FPS | Loop |
|---|---|---|---:|---:|---|
| boss_gate_idle.png | 128×160 | 64×80 | 1 | 1 | sí |
| boss_gate_damage.png | 128×160 | 64×80 | 2 | 12 | no |
| boss_gate_destroy.png | 128×160 | 64×80 | 6 | 10 | no |
| boss_gate_turret_idle.png | 64×64 | 32×32 | 1 | 1 | sí |
| boss_gate_turret_fire.png | 64×64 | 32×32 | 3 | 12 | no |
| boss_gate_turret_destroy.png | 64×64 | 32×32 | 5 | 10 | no |
| boss_gate_hatch_open.png | 64×64 | 32×32 | 3 | 10 | no |
| boss_gate_hatch_close.png | 64×64 | 32×32 | 3 | 10 | no |

IDs `bossGate.{idle,damage,destroy}`, `bossGateTurret.{idle,fire,destroy}`, `bossGateHatch.{open,close}`. La representación gráfica jamás decide spawn/disparo/vulnerabilidad.

No se necesitan nuevos VFX obligatorios: se reutilizan muzzle, hit spark, explosion.small/medium. Gate turrets usan el callback visual de fire existente.

## Validación y límites

Validación final: **377 tests en 29 archivos**, typecheck, build release y build:devtools correctos. Persiste el aviso previo de Vite por bundle mayor a 500 KB. No hay lint configurado.

- Luna auditó cámara/editor; Luna escribió `tests/level3-boss.test.ts` (8 tests). Implementación e integración principal revisadas por el orquestador.
- `tests/level3.test.ts`: cámara XY/modos/transiciones/bounds, carga, checkpoints por orden, triggers con rollback, activación y proyectiles elevados, daños por componentes y operaciones del editor.
- `scripts/level3-check.cjs`: 44 saltos reales guiados, pickups, tres CameraModes, muerte/respawn elevado, torretas con tiros reales desde alturas distintas, hatches/dogs/límite, reset y salida. Después dibuja/edita una Camera Zone, crea trigger2D + RobotDog y verifica PLAY FROM HERE alto. Fixtures invulnerables: valida flujo y alcance, no dificultad humana.
- Levels 1/2: tests anteriores conservados y scripts de editor legacy, Level 2, campaña/respawn pasan. El cambio de expectativa del Animation Viewer incluye los cuatro nuevos grupos, no elimina assertions.
- Muestra Chrome headless local, 1100×900: Level 1 57 FPS/83 draw calls/23 texturas; shaft 57 FPS/167 calls/3 texturas; arena 57–58 FPS/118–119 calls/5 texturas. Referencia simultánea, sin caída de FPS detectada; no certifica 60 FPS en hardware real. Texturas de arte nuevo aún no cargadas.
- Sin wall jump, double jump, dash, física nueva, iluminación ni nuevo renderer. RobotDog usa AI simple, no pathfinding. El kit definitivo y el balance requieren revisión humana con arte disponible. No se promete duración exacta de una partida.
