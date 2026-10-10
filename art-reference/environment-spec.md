# Environment art contract — Fase 15

## Fase 15.5 — densidad 2×

Los tamaños de las tablas siguientes son **LEGACY 1× / WORLD**. Se conservan
todos los PNG actuales. Para **NEW 2×**: ground 32×32 SOURCE → 16×16 WORLD;
platform 32×16 → 16×8 WORLD; backgrounds 512×480 → 256×240 WORLD.
Props/animados duplican source frames, manteniendo su tamaño WORLD de la tabla.
`EnvironmentAsset.width/height` son WORLD; `artScale: 2` genera metadata SOURCE
cuando se integre un PNG 2×. No cambia tile grid, offsets, clipping, seams,
colliders, parallax ni posiciones. Los extremos del tile deben continuar sin
padding; no mezclar atlas en TiledVisual. Framebuffer 512×480 y cámara 256×240.
Registro e inventario completo: [art-2x-migration.md](art-2x-migration.md).

## Estado auditado y alcance

El mundo existente mide 9600 unidades, con resolución lógica 256×240, coordenadas
X/Y y suelo habitual en y=44 (elevaciones a 56). No existía Tile ni grid físico:
Level.solids/oneWays son AABB de tamaños arbitrarios. LevelView dibujaba rectángulos,
superficies, bordes de fosos y props; TiledVisual y tres capas parallax ya existían.
No había PNG de environment/background; el pipeline conservaba sus placeholders.

Se prepara únicamente x=0…1024 (cuatro pantallas), sin extender el arte al resto.
Incluye plataformas en 180/620, bloques sólidos en 350/900, foso 520…564 y checkpoint
620. Después de x=1024 se conserva el estilo anterior; el boss no está en el slice.
La aprobación del arte externo será necesaria antes de vestir el nivel completo.
**Kit completo integrado: los 30 PNG (12 tiles y 18 walls/props/animated/background)
usan ahora SOURCE 2×, con las mismas dimensiones WORLD de la tabla.**
Ground 32×32 ocupa 16×16 WORLD; plataformas 32×16 ocupan 16×8.
Los assets están activados en environment.ts. El montaje existente conserva
paredes x=736…1024, 13 instancias de props (incluidas dos ramas), ventilador
de cuatro frames y checkpoint x=620 con estados waiting/active. FAR/MID/NEAR
usan 512×480 SOURCE → 256×240 WORLD, con velocidades y periodo sin cambios.
Fuera de x=0…1024 se conservan los placeholders del nivel. No cambian colisiones,
checkpoints físicos ni layout. Los fallbacks siguen disponibles si falla un PNG.

## Métrica y montaje

Ground: celdas 16×16; plataformas: 16×8 visuales, alineadas a su superficie física.
Una one-way de 6 px conserva exactamente esos 6 px de collider; el arte puede
extenderse 2 px por debajo. Los dibujos no cambian velocidad, colisión ni spawn.
Ground sólido corto se recorta desde arriba: no se escala para rellenar su celda.
Las variantes top01/02/03 usan coordenadas/seed constantes, solo al construir.
Bordes se reservan a límites reales; x=1024 no crea un acantilado artificial.

EnvironmentView construye el kit una vez. environmentPieces subdivide rectángulos
visuales; esos objetos jamás entran en CollisionSystem. Un TiledVisual por asset
comparte material entre todas sus piezas. Ground/platform conservan los rectángulos
originales como fallback bajo las texturas. Props usan SpriteVisual y primitivas
compartidas si faltan PNG. Animated vent usa SpriteAnimator; no controla gameplay.
CheckpointView representa waiting/active observando el manager existente.

ParallaxBackground sigue siendo el único sistema: velocidades .15/.40/.75,
periodo 512, tres copias por capa y PNG repetido cada 256 unidades. Recicla mediante
posición/modulo, sin crear meshes durante scroll. NEAR usa ahora Z=-2: antes usaba
por error FOREGROUND=6. El único foreground nuevo son dos ramas en y=206/214,
lejos de la zona jugable. No se cambió CameraController.

Draw order: far -6, mid -4, near -2, back decor -0.5, level 0, tiles 1.2,
checkpoint 2, pickups 2.5, entidades 3, proyectiles 4, FX 5, foreground 6, debug 7.
F1 conserva bounds físicos; F2 muestra bounds/anchor/origin de props y beacon.

Se mantiene frustum culling de Three.js. No se añade otro sistema de culling ni
atlas de tiles: las medidas actuales no justifican ese refactor. SpriteVisual ya
acepta atlases para props. Repeat de TiledVisual necesita PNG completo por tile;
no meter tiles repetibles en un atlas sin modificar su contrato de UV.

## Producción externa

Rutas relativas a public/assets/environment/. Todos PNG RGBA, sin blur ni
anti-aliasing, alpha 0/255, paletas compactas. Legacy: 1 source px = 1 WORLD unit;
new 2×: 2 source px = 1 WORLD unit. Source frame y visual WORLD se declaran
independientemente. Tiras animadas horizontales, celdas uniformes.
Anchor bottom-center para props y contrato de tiles; el montador de tiles usa
rectángulos con esquina inferior izquierda, independiente de este anchor. Fondos
center. OffsetX/Y=0. No padding en texturas repetidas. NearestFilter, mipmaps off.

FAR puede ser opaco, con cielo/montañas de poco contraste. MID/NEAR transparentes:
no pintar cielo opaco que oculte la capa anterior. Sus extremos horizontales deben
unir exactamente; evitar detalles brillantes que parezcan balas/pickups. Las
superficies top comparten borde izquierdo/derecho entre variantes; corners unen
con top/side, fill une en ambos ejes. No cubrir el rifle ni las siluetas activas.

| PNG | Frame / visual | Frames | FPS | Loop | Layer | Tileable | Anchor |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| tiles/jungle/ground_fill.png | 16×16 | 1 | 1 | no | LEVEL_TILES (1.2) | X/Y | bottom-center |
| tiles/jungle/ground_top_01.png | 16×16 | 1 | 1 | no | LEVEL_TILES (1.2) | horizontal | bottom-center |
| tiles/jungle/ground_top_02.png | 16×16 | 1 | 1 | no | LEVEL_TILES (1.2) | horizontal | bottom-center |
| tiles/jungle/ground_top_03.png | 16×16 | 1 | 1 | no | LEVEL_TILES (1.2) | horizontal | bottom-center |
| tiles/jungle/ground_left_edge.png | 16×16 | 1 | 1 | no | LEVEL_TILES (1.2) | vertical | bottom-center |
| tiles/jungle/ground_right_edge.png | 16×16 | 1 | 1 | no | LEVEL_TILES (1.2) | vertical | bottom-center |
| tiles/jungle/ground_top_left.png | 16×16 | 1 | 1 | no | LEVEL_TILES (1.2) | no | bottom-center |
| tiles/jungle/ground_top_right.png | 16×16 | 1 | 1 | no | LEVEL_TILES (1.2) | no | bottom-center |
| tiles/military/platform_metal_left.png | 16×8 | 1 | 1 | no | LEVEL_TILES (1.2) | no | bottom-center |
| tiles/military/platform_metal_middle.png | 16×8 | 1 | 1 | no | LEVEL_TILES (1.2) | horizontal | bottom-center |
| tiles/military/platform_metal_right.png | 16×8 | 1 | 1 | no | LEVEL_TILES (1.2) | no | bottom-center |
| tiles/military/platform_metal_single.png | 16×8 | 1 | 1 | no | LEVEL_TILES (1.2) | no | bottom-center |
| tiles/military/bunker_wall.png | 16×16 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | X/Y | bottom-center |
| tiles/military/concrete_wall.png | 16×16 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | X/Y | bottom-center |
| props/jungle/grass.png | 16×8 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| props/jungle/vines.png | 16×32 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| props/jungle/small_plant.png | 24×24 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| props/jungle/rock.png | 16×12 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| props/jungle/foreground_branch.png | 32×12 | 1 | 1 | no | FOREGROUND (6) | no | bottom-center |
| props/military/crate.png | 16×16 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| props/military/barrel.png | 12×20 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| props/military/pipe.png | 16×16 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| props/military/barrier.png | 32×16 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| props/military/warning_sign.png | 16×24 | 1 | 1 | no | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| animated/vent_fan.png | 16×16 | 4 | 6 | sí | LEVEL_BACK_DECOR (-0.5) | no | bottom-center |
| animated/checkpoint_waiting.png | 16×32 | 2 | 3 | sí | DECORATION (2) | no | bottom-center |
| animated/checkpoint_active.png | 16×32 | 4 | 6 | sí | DECORATION (2) | no | bottom-center |
| background/far/bg_jungle_far.png | 256×240 | 1 | 1 | no | BACKGROUND_FAR (-6) | horizontal | center |
| background/mid/bg_jungle_mid.png | 256×240 | 1 | 1 | no | BACKGROUND_MID (-4) | horizontal | center |
| background/near/bg_jungle_near.png | 256×240 | 1 | 1 | no | BACKGROUND_NEAR (-2) | horizontal | center |

## Activación e integración

Añadir enabled: true a la entrada correspondiente de src/config/environment.ts
cuando exista el PNG. assets.ts deriva path/url/sheet/visual/clip centralmente;
no hay rutas en Level ni en gameplay. Puede activarse cada pieza por separado.
Si la carga falla, AssetManager avisa una vez y el fallback sigue funcionando.
Los sprites animados no controlan checkpoint, daño ni timings de entidades.

Ground fill/top/edges y metal platform permiten el primer montaje; después producir
FAR/MID/NEAR y plant/grass/crate para revisar contraste. El resto del kit completa
la transición a instalación militar al final del slice. No extrapolar al boss aún.
Props no colisionables: no dibujarlos con la misma superficie clara del terreno
sólido. Bunker/concrete walls decoran x=736…1024 detrás de entidades.

## Validación y límites

Baseline local Chrome: 60 FPS, 65 draw calls en el inicio. Con fallbacks del slice:
60 FPS, 62 draw calls. Medidas locales; no garantizan todos los dispositivos.
El rendimiento/contraste del arte definitivo debe verificarse cuando lleguen PNG.
Sin esos PNG no puede aprobarse seam/paleta/detalle final; sí se verifican UV,
recorte, repeat, separaciones y fallbacks. Los tests cubren selección determinista,
cobertura sin gaps/overlap, plataforma visual vs collider, reuse de material,
parallax detrás de gameplay y ausencia de mutación de LevelData.

238 tests, typecheck y build pasan; no existe script lint. El recorrido real de
x=62 a x=1021 conserva tres vidas y 60 FPS: saltos sobre bloques/foso y plataformas
existentes. Se comprobaron 16:9, 16:10, 4:3 y móvil sin deformación. Regresiones de
M/S/L, drops únicos, checkpoints, game over/respawn y tres fases del boss pasan.
Estrés con cinco Soldiers, tres FlyingEnemies, Turret y 253 VFX: 60 FPS, ningún
descarte y memoria GPU estable. No se detectaron regresiones de gameplay.
Los fallbacks mantienen legibles Player/enemigos/VFX; props deliberadamente oscuros
y foreground solo en la zona superior. La paleta final aún no está disponible.

## Futura Fase 16: editor (no implementado)

Un editor debería tener capas separadas de colisión, kit visual, props/parallax,
spawn/checkpoints/boss; snapping visual 16 px opcional, sin imponerlo a AABB físicos;
paleta del manifest, selección de variantes, preview anchors/Z, undo/redo y
validación/import/export JSON. Primero aprobar este slice con arte final y
estabilizar su contrato; el editor debe consumirlo, no introducir otro renderer.

Primera entrega integrada: [environment-tiles-integration.md](environment-tiles-integration.md), con IDs, rutas, comprobación de seams y alcance exacto.
