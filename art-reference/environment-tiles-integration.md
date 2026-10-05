# Primera entrega de tiles: integración visual

Fuente: environment-slice-tiles.zip y carpeta extraída; sus doce entradas son
idénticas. Se copiaron byte por byte, sin reescalar ni editar arte. Referencia
externa conservada en environment-slice-inventory.md.

Los ocho ground son RGBA 16×16; las cuatro plataformas RGBA 16×8. Alpha es 255
en todos los píxeles: opacos, sin semitransparencia ni antialias. 1 frame, non-loop,
anchor bottom-center, offsets X/Y=0 y capa DRAW.levelTiles=1.2. Texturas compartidas
por AssetManager, NearestFilter, mipmaps off; material compartido por ID en TiledVisual.

Rutas relativas a public/assets/environment/:

| PNG | ID del manifest | Frame |
| --- | --- | --- |
| tiles/jungle/ground_fill.png | environment.ground.fill | 16×16 |
| tiles/jungle/ground_top_01.png | environment.ground.top01 | 16×16 |
| tiles/jungle/ground_top_02.png | environment.ground.top02 | 16×16 |
| tiles/jungle/ground_top_03.png | environment.ground.top03 | 16×16 |
| tiles/jungle/ground_left_edge.png | environment.ground.left | 16×16 |
| tiles/jungle/ground_right_edge.png | environment.ground.right | 16×16 |
| tiles/jungle/ground_top_left.png | environment.ground.topLeft | 16×16 |
| tiles/jungle/ground_top_right.png | environment.ground.topRight | 16×16 |
| tiles/military/platform_metal_left.png | environment.platform.left | 16×8 |
| tiles/military/platform_metal_middle.png | environment.platform.middle | 16×8 |
| tiles/military/platform_metal_right.png | environment.platform.right | 16×8 |
| tiles/military/platform_metal_single.png | environment.platform.single | 16×8 |

## Alcance y alineación

Suelo x=0…520 y x=564…1024, bloques sólidos x=350…390 y x=900…944,
y plataformas one-way x=180…260 y x=620…716. Fuera de x=1024 se conserva fallback.
No se crea un borde/cliff en el corte del slice. platform_single está integrado
pero no se añade una plataforma física de 16 px: el layout actual no contiene una.

Ground top permanece exactamente en la superficie física original. Los bloques
bajos recortan la celda desde arriba y no la estiran. Plataforma visual de 8 px
termina en y=74, igual que el collider existente de 6 px: sus 2 px extra están
por debajo, no desplazan los pies. No se modificó ningún dato de Level/Collision.

Variantes: tileVariant usa floor(x/16), floor(y/16) y seed 17, con resultado módulo 3;
se calcula al construir las piezas. No hay Math.random ni cambios durante scroll.

## Seams y debug

Se comprobaron igualdad de extremos RGBA para fill/fill, top A/B/C, corner/top,
corner/edge, edge/fill, left/middle, middle/middle y middle/right. El PNG single
se registra a escala 1:1. No se detectaron huecos transparentes ni bordes suavizados.

Se corrigió una fase UV del montador previo: fill/edges se alineaban desde abajo
para altura 44, leyendo la fila 4 junto al top. Ahora repiten desde arriba y los
bordes autorados encajan. Es un cambio de UV; posición/tamaño físicos y PNG intactos.

F1: colliders verdes. F2: bounds de piezas cyan, anchor bottom-center amarillo,
origin inferior izquierdo magenta. Se crean los marcadores una sola vez al activar
F2; se reutilizan después. Las piezas fill/middle grandes repiten la textura: su
wireframe marca el batch, los tops marcan cada celda; no se estira el patrón.

## Validación

Baseline: 60 FPS / 62 draw calls al inicio con fallback. Tiles activos: 60 FPS /
83 draw calls en la misma vista. Es una medida local de Chrome, no garantía universal.
Contraste moderado: el musgo marca la superficie, tierra/metal quedan por debajo de
las siluetas activas. No se editó paleta. El cambio a placeholder en x=1024 es deliberado.

238 tests, typecheck y build pasan. Recorrido con teclas reales x=62…1021 sin perder
vidas, plataformas/foso, cuatro proporciones, crouch y tiros altos/bajos, disparos,
Machine Gun, drops M/S/L con caída/recogida, checkpoints, respawn/game over verificados.

## Pendientes (18 PNG)

- Walls: tiles/military/bunker_wall.png, tiles/military/concrete_wall.png.
- Jungle props: props/jungle/grass.png, vines.png, small_plant.png, rock.png,
  foreground_branch.png (todos bajo props/jungle/).
- Military props: props/military/crate.png, barrel.png, pipe.png, barrier.png,
  warning_sign.png (todos bajo props/military/).
- Animated: animated/vent_fan.png, checkpoint_waiting.png, checkpoint_active.png
  (todos bajo animated/).
- Backgrounds: background/far/bg_jungle_far.png,
  background/mid/bg_jungle_mid.png, background/near/bg_jungle_near.png.

Se mantienen los fallbacks existentes. Solo se activaron los doce tiles de esta
entrega; FAR/MID/NEAR, props y foreground no reciben arte nuevo.
