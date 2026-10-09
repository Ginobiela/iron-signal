# Iron Signal — contrato gráfico

## Fase 15.5 — SOURCE vs WORLD

El modo principal usa `ART_SCALE = 2`, framebuffer 512×480 y cámara 256×240 WORLD.
Los contratos siguientes describen **LEGACY 1×**, conservados para los PNG actuales.
El nuevo arte **2×** duplica source frame/atlas/padding, pero mantiene `visual.width/height`,
offsets, anchors WORLD y FPS. Player/Soldier: 64×64 SOURCE → 32×32 WORLD;
Runner/Turret: 48×48 → 24×24; Flying: 64×48 → 32×24. No convertir los PNG existentes.
`SpriteAsset.artScale` es por asset y no se impone desde el render global. NearestFilter,
sin mipmaps, antialias false, pixelRatio 1. El viewer distingue fuente, mundo, densidad,
anchor source y origen WORLD; sus botones son zoom de preview, no densidad del asset.
Contrato e inventario completo: [art-2x-migration.md](art-2x-migration.md).

Todos los recursos deben ser originales. El mundo lógico sigue siendo **256×240**;
el framebuffer usa **512×480**. Los PNG legacy permanecen 1×. No se modifica gameplay
para acomodar ilustraciones. No se necesitan assets definitivos para ejecutar el juego.

## Origen y dimensiones

La posición física existente es la esquina inferior izquierda del collider. Las vistas
convierten esa posición a bottom-center (x + ancho del collider / 2, y) o, para
voladores, a center (x + ancho / 2, y + alto / 2). Cambiar el PNG nunca mueve esa posición.
`visual.width/height`, `offsetX/Y` y `scaleX/Y` en el manifest son independientes del
collider. El offset se aplica después del anchor; flipX afecta solo el plano, nunca
el offset, las coordenadas, el collider o el apuntado. Mantener scaleX/Y positivos.

| Entidad | Canvas por frame | Anchor | Silueta física actual (solo referencia) |
| --- | --- | --- | --- |
| Player | 32×32; 32×40 si necesita espacio superior | bottom-center | 12×26; crouch 12×12 |
| Soldier | 32×32 | bottom-center | 12×24 |
| Runner | 24×24 | bottom-center | 14×16 |
| Turret | 24×24 | bottom-center | 20×20 |
| FlyingEnemy | 32×24 | center | 20×14 |
| WeaponPickup | 16×16 | bottom-center | 12×12 |
| Boss | 64×80 | bottom-center | 56×72 |
| Proyectiles / FX | 4×4 / 8×8–32×32 | center | independiente de la imagen |

Para Player, colocar los pies en el centro inferior del canvas en todos los frames.
Usar transparencia superior/lateral para mantener una silueta de unas 26 unidades
de alto al principio. Crouch conserva el mismo canvas y baja el contenido hasta los
pies; no estirar una pose de pie. Las direcciones originales son **right** y se
reflejan horizontalmente para left. Evitar texto/detalles asimétricos en personajes
que no puedan reflejarse. El indicador transportado M/S/L es un child independiente.

## Animaciones

| Player | Frames recomendados | FPS inicial | Loop |
| --- | --- | --- | --- |
| idle | 4 | 6 | sí |
| run | 6 | 10 | sí |
| jump | 2 | 6 | sí |
| fall | 2 | 6 | sí |
| crouch | 1–2 | 6 | sí |
| shoot | 2 | 12 | sí |
| runShoot | 6 | 10 | sí |
| jumpShoot | 2 | 12 | sí |
| crouchShoot | 2 | 12 | sí |
| death | 6 | 10 | no |

El estado visual deriva de alive, crouching, shooting, grounded y velocity.
No se crean estados físicos nuevos. `SpriteAnimator.play(name)` no reinicia el
mismo clip; `tick(dt)` avanza por tiempo y `onComplete` se emite una vez en clips
no-loop. El API anterior `update(name, dt)` sigue funcionando.

Soldier: idle/run/shoot/death. Runner: run/death. Turret: idle/shoot/death.
Flying: fly/hit/death. Boss: idle/attack/damage/death. La muerte lógica desactiva
ataques y contactos inmediatamente; la vista puede terminar su clip sin hitbox activa.
Pausa congela animaciones y FX. Respawn/restart restaura la vista del jugador.

### Apuntado

Opcionalmente agregar IDs `player.run_horizontal`, `player.run_diagonal`,
`player.run_up`, `player.runShoot_diagonal`, `player.jumpShoot_up`, etc.
El sufijo horizontal/diagonal/up se aplica a cualquier estado del jugador.
La vista busca variante → clip base → pose de movimiento → idle → placeholder.
`includesWeapon: true` oculta el cañón geométrico si el PNG incluye el arma;
sin esa opción se conserva el cañón que sigue aimDirection. No afecta la salida física
del proyectil. Todavía no es necesario producir todas las variantes.

## Archivos y registro

```text
public/assets/
  sprites/player/player_idle.png, player_run.png, player_jump.png, ...
  sprites/enemies/soldier/, runner/, turret/, flying/
  sprites/weapons/machinegun.png, spread.png, laser.png, rifle.png
  sprites/boss/boss_idle.png, boss_attack.png, boss_damage.png
  sprites/fx/muzzle_flash.png, hit.png, explosion.png, powerup_pickup.png
  sprites/environment/ground.png, platform.png, edge.png, vegetation_back.png,
                      vegetation_front.png, decoration.png
  background/layer_far.png, layer_mid.png, layer_near.png
  sounds/
  music/
```

`src/config/assets.ts` es el único registro de rutas. `path` indica la ruta prevista;
**url activa la carga**. No se solicitan recursos que todavía no existen. Ejemplo:

```ts
'player.run': {
  ...sprite('sprites/player/player_run', 32, 32, 6, 10),
  url: 'assets/sprites/player/player_run.png',
},
```

Para un PNG de un frame usar frameCount 1 y clip.frames [0]. Es válido activar
solo idle: los estados sin arte conservan una pose disponible o los placeholders.
Un archivo activado pero ausente produce warning en desarrollo y fallback;
no bloquea el juego. La carga se centraliza y una URL compartida se descarga una vez.
Las rutas son relativas para funcionar también en GitHub Pages.

### Sprite sheets

Formato recomendado: **PNG RGBA, strip horizontal sin trimming ni rotación**.
Player run: 192×32 = 6 celdas de 32×32. Configurar:

```ts
sheet: { frameWidth: 32, frameHeight: 32, frameCount: 6, columns: 6 },
clip: { frames: [0, 1, 2, 3, 4, 5], frameRate: 10, loop: true },
```

También se admiten grillas, margin/spacing y un atlas con `atlas: [{ x, y, width,
height }, ...]`. Las coordenadas del atlas parten de arriba a la izquierda; mantener
un canvas uniforme y frames sin recortar para conservar el anchor. Distintos IDs pueden
compartir `url`, sheet y atlas, seleccionando diferentes índices en clip.frames.

NearestFilter en min/mag, mipmaps desactivados, sRGB y UV con inset de medio texel
evitan bleeding. No se clonan texturas por frame: cada instancia escribe las UV
de su propio plano. Padding de 1 px es opcional (margin/spacing deben describirlo).
Si una tira contiene menos frames que el contrato, se limita la celda disponible;
conviene actualizar también frameCount y clip.frames para evitar repetir poses.

### Fondos y tiles

Fondos RGBA tileables de 256×240, repetibles horizontalmente; bordes izquierdo y
derecho deben continuar exactamente. Far/mid/near conservan velocidades .15/.40/.75;
near ocupa BACKGROUND_NEAR (-2), detrás de gameplay; debe conservar transparencia.
Tres copias de cada bloque de 512 unidades cubren la cámara sin una imagen gigante.
Ground 16×16 y platform 16×8 se repiten en ambos ejes; usar PNG completos, sin atlas
ni padding, con `tileable: true`. Los detalles, bordes y vegetación son sprites
separados; jamás definen colliders. La geometría del nivel sigue siendo la fuente física.

## Capas, debug y rendimiento

`DRAW` en assets.ts centraliza Z: far -6, mid -4, near -2, level 0,
surface 1, decorations 2, pickups 2.5, entidades 3, proyectiles 4,
FX 5, foreground 6 y debug 7. Los detalles locales usan offsets definidos allí.
La UI permanece HTML. Se conserva la cámara ortográfica, antialias false y pixelRatio 1.
El canvas escala en enteros cuando cabe y mantiene proporciones con letterboxing.

F1 muestra colliders y datos; F2 muestra **cyan: sprite bounds**, **amarillo: anchor**,
**magenta: entity origin**. Ambos modos se pueden combinar para verificar crouch,
padding y offsets. Bounds visuales corresponden al canvas completo, no a píxeles opacos.
Los proyectiles conservan su pool; FX animados usan un pool de 24 visuales y partículas
existentes como fallback. No se cargan recursos ni recrean meshes en cada update.

## Orden sugerido del primer arte

1. Player idle/run/crouch: validar pies, escala y flip antes del resto de sus clips.
2. Soldier idle/run y Flying fly: validar anchors terrestres/centrados y cargo independiente.
3. Pickups M/S/L de 16×16, 2–4 frames: validar caída y recogida sin cambiar física.
4. Player shoot/jump/fall y variantes de apuntado que hagan falta.
5. Hit/explosion/muzzle, luego backgrounds y tiles. Boss y UI final pueden esperar.


El primer Player definitivo ya está integrado: ver [normalización de la hoja adjunta](player/README.md). Usa celdas 32×32, idle 6 FPS, run 11 FPS y crouch 7 FPS no-loop; el collider permanece independiente.

El contrato específico de combat VFX y las rutas public/assets/sprites/fx están en [combat-vfx.md](combat-vfx.md). Los sprites anteriores siguen usando sus anchors y colliders independientes.

El kit modular de escenario usa 16x16 (ground) y 16x8 (platforms), sin cambiar colliders. Contrato de PNG y alcance del slice: [environment-spec.md](environment-spec.md).
