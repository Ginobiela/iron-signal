# Inventario del vertical slice

Alcance: x=0..1024. Total: 30 PNG. Producidos en esta entrega: ocho ground tiles y cuatro platform tiles. Pendientes: dos walls, diez props, tres animados y tres backgrounds.

Rutas relativas a public/assets/environment/. Todos PNG RGBA, alpha 0/255, offsetX/Y=0 y sin padding. Frames animados en tira horizontal.

Direccion visual: tierra y roca de contraste moderado, musgo verde apagado, linea caminable clara; plataformas gris verdoso. Paleta inicial de 12 colores. Esta propuesta aun requiere aprobacion.

Orden posterior al primer conjunto: FAR/MID/NEAR y small_plant/grass/crate para contraste; luego resto del kit. FAR puede ser opaco; MID/NEAR transparentes. Parallax .15/.40/.75, capas -6/-4/-2. Foreground solo ramas altas.

Los 12 tiles iniciales son opacos dentro de PNG RGBA; alpha binario sin bordes suavizados. Se comprobaron igualdad de extremos repetibles y empalmes entre piezas. El montaje de prueba 256x240 es una composicion de QA, no una captura del juego ni un nuevo nivel. No se modificaron colliders, codigo o activacion.

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
