# Integración de la hoja de Player

`source.png` es una copia byte por byte del PNG suministrado (1536×1024 RGBA).
Su SHA-256 está en `normalization.json`, junto con los 12 recortes, ejes anatómicos,
baselines y bounds finales. No se usa directamente en el navegador.

La extracción detecta componentes conexos con alpha ≥128, no una grilla. Los
recortes de run se solapan; cada pose conserva exclusivamente su propia máscara.
El original tiene 1.107.627 píxeles transparentes y 465.237 semitransparentes,
ninguno con alpha 255 (máximo 254). Los derivados usan alpha binario 0/255 para
eliminar el halo de baja opacidad sin modificar el original ni difuminar los bordes.

Se aplica la misma transformación de escala **1/14** a las 12 poses, con nearest
neighbor. Cada frame tiene canvas 32×32 y origen bottom-center (16,32), con los
pies apoyados en el borde inferior. Se conservan márgenes para mochila y rifle.
El eje del torso usa el visor como landmark estable y una distancia calibrada según
la postura: 36 px de origen en idle, 54 en run, 50 en crouch. No se centra el bbox.

La fase vertical de muestreo se ajusta en píxeles del original: idle [-3,-3,-3,-3],
run [3,3,4,3,3,5], crouch [0,0]. Estas traslaciones subpíxel evitan la pérdida del
visor y un salto de un píxel en el último run; **todos** los frames terminan en
la misma fila 32 y los seis run conservan cabeza y visor en las mismas filas.
No hay resize independiente, blur, bilinear ni redibujo.

El canvas visual es 32×32, scaleX/Y 1, offsets X/Y 0, independiente del collider
12×26/12×12. La figura opaca mide 21 px en idle, 20 en run y 14 en crouch.
Se eligió una escala común que deja crouch por debajo del tiro alto de laboratorio
(centro a 16 px, radio 1,5 px). La proporción agachado/de pie procede del dibujo
original; no se comprime únicamente crouch para igualarlo al collider.

| ID | Sheet | FPS | Reproducción |
| --- | --- | --- | --- |
| player.idle | 128×32, 4 frames | 6 | loop |
| player.run | 192×32, 6 frames | 11 | loop |
| player.crouch | 64×32, 2 frames | 7 | entrada y mantener segundo |

Las dos poses crouch apenas difieren; una entrada corta evita un parpadeo repetido.
Todas incluyen el rifle y usan `includesWeapon: true` para evitar duplicarlo.
Left usa flipX y el mismo PNG. Las poses de disparo/aéreas o apuntado hacia arriba sin arte
usan el placeholder existente, con su cañón orientable y origen físico original.
No se usa un rifle horneado en el PNG para representar un apuntado incompatible.

Para reproducir los derivados:

```sh
python scripts/normalize-player.py
```

La herramienta requiere Pillow y NumPy; solo se usa para preparar assets, nunca
para instalar, compilar ni ejecutar el juego. Incluye assertions para número de
poses, integridad del source, alpha binario, baseline y ausencia de clipping.


Los ocho PNG adicionales de jump/fall y disparo se copiaron sin reescalado: alpha binario, baseline fila 32 y canvas 32×32 por frame. Ver el manifest para sus variantes horizontal/up/diagonal.

Los cinco PNG siguientes mantienen ese mismo contrato, sin alterar el original:

| ID | Sheet | FPS | Reproducción |
| --- | --- | --- | --- |
| player.jumpShoot_horizontal | 64×32, 2 frames | 12 | loop |
| player.jumpShoot_up | 64×32, 2 frames | 12 | loop |
| player.jumpShoot_diagonal | 64×32, 2 frames | 12 | loop |
| player.crouchShoot_horizontal | 64×32, 2 frames | 12 | loop |
| player.death | 192×32, 6 frames | 10 | una vez |

Death se selecciona para cualquier último apuntado y oculta su visual al terminar;
respawn reinicia el clip. Las variantes no suministradas mantienen fallback.
