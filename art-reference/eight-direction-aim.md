# Fase 18 — Apuntado en ocho direcciones

La limitación anterior estaba en `Player.updateCombat`: solo resolvía horizontal/up y nunca consultaba down. InputManager, Weapon, Spread y Laser ya aceptaban el input/vector necesario. No se modificaron esas clases, físicas, balance, hitboxes, plataformas ni AI.

`entities/playerAim.ts` centraliza la resolución sobre el vector reutilizado de Player. Down tiene prioridad: en aire produce down/diagonalDown; en suelo conserva horizontal+crouch. Up conserva vertical/diagonal superior. Sin vertical se conserva facing. Ambos inputs horizontales se cancelan; down+up da prioridad a down. Player muerto conserva la mira y no actualiza/dispara el arma. El Game sigue bloqueando combate fuera de PLAYING.

Las diagonales usan Math.SQRT1_2, sin new Vector2 por frame. Las armas siguen leyendo este único vector y los mismos valores del Gameplay Tuner. Spread aplica sus rotaciones configuradas alrededor de la mira, incluso hacia abajo; se mantiene la reserva del volley completo y el pool existente.

## Orígenes inferiores

Se conserva el pivot vertical existente. Los perfiles de `PLAYER_LOWER_MUZZLES` están expresados en **world units**, independientes del source 64×64:

| Pose | Desplazamiento X del pivot, según facing | Distancia del cañón |
|---|---:|---:|
| down | 12 | 9 |
| diagonalDown | 4 | 15 (muzzleDistance original) |

Los getters `projectileOriginX/Y` y `muzzleDistance` se usan al disparar, para el gun fallback y para muzzle VFX inferiores. Desplazar el pivot hacia el lateral permite que el extremo del cañón y los cinco pellets del Spread normal queden fuera del cuerpo. Las trayectorias siguen siendo normalizadas y se mantiene el sweep desde el origen hasta el extremo del cañón: una pared/suelo en ese recorrido bloquea el proyectil. No se desplazan colliders ni se ignoran sólidos. Owner player sigue excluyendo colisiones contra sí mismo mediante el CombatSystem existente.

## Arte integrado

`rendering/playerAnimation.ts` centraliza el mapping existente y añade las poses inferiores. No se invierte el sprite en Y. LEFT usa flipX. Las cuatro entradas tienen URL activa y Animation Viewer las descubre automáticamente. Si una textura falla, se conserva el fallback geométrico.

| Asset ID | Archivo relativo a public/ | Frame source | Frames | FPS | Loop | World / anchor |
|---|---|---|---:|---:|---|---|
| player.aim_down | assets/sprites/player/player_aim_down.png | 64×64 | 1 | 1 | sí | 32×32 / bottom-center |
| player.aim_diagonalDown | assets/sprites/player/player_aim_diagonalDown.png | 64×64 | 1 | 1 | sí | 32×32 / bottom-center |
| player.jumpShoot_down | assets/sprites/player/player_jumpShoot_down.png | 64×64 | 2 | 12 | sí | 32×32 / bottom-center |
| player.jumpShoot_diagonalDown | assets/sprites/player/player_jumpShoot_diagonalDown.png | 64×64 | 2 | 12 | sí | 32×32 / bottom-center |

Los cuatro PNG suministrados son RGBA con alpha binario (0/255). Aim strips: 64×64 total; shooting strips: 128×64. Source frames 64×64, world 32×32, offsets 0, anchor bottom-center. Los flashes usan PLAYER_LOWER_VISUAL_MUZZLES: down (8,4), diagonalDown (14,7), en world units respecto al anchor; el origen físico del proyectil no cambia.

El manifest contiene 26 entradas Player con PNG (incluyendo aliases). Las pruebas verifican también carga, tamaño, flip y fallback de los cuatro clips inferiores.

## Inspector y validación

LIVE GAME del Tuner muestra aimDirection derivada (RIGHT, LEFT, UP, DOWN o sus diagonales), aimVector.x/y, grounded/airborne y weapon. El vector es la única fuente del estado, sin otro enum de direcciones almacenado.

- Luna A: auditoría acotada sin cambios.
- Luna B: `tests/eight-direction-aim.test.ts`, 17 casos de gameplay, Spread, pooling y colisiones.
- Agente principal: diseño/implementación, revisión de pruebas, visuales/manifest/muzzle, inspector y tests de integración visual y muzzle horneado.
- `scripts/eight-direction-check.cjs`: Chrome/Playwright con Vite dev en :5173. Comprueba controles de suelo/aire y no-fire aim para las cuatro armas, y daño a enemigo debajo del Player. La fixture de impacto congela únicamente esa instancia enemiga para alinear el blanco de forma determinista; no cambia el código de AI.
- `npm test`: 322 tests en 22 archivos; typecheck y `npm run build` pasan. Permanece el warning previo del bundle Three.js >500 KB.

No se generó ni reescaló ningún PNG; se integraron los cuatro archivos aprobados.
