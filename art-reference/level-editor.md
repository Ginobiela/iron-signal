# Fase 16 — Level Editor, schema v1

## Acceso y arquitectura

`npm run dev` → menú → **TOOLS · LEVEL EDITOR**, o `http://127.0.0.1:5173/level-editor.html`. **BACK TO GAME** vuelve al menú. Es una entrada Vite independiente, compatible con refresh directo y hosting estático en subdirectorios. `npm run build` incluye el editor; `npm run build -- --mode release` lo excluye y oculta su enlace. Sin frameworks ni router nuevos.

Antes, Level 1 era un objeto TypeScript en `signalWorks.ts`: width 9600, spawn (62,44), 13 ground segments, 36 plataformas, 21 grupos, 47 enemigos, 6 checkpoints, secciones y boss. Level construía solids/oneWays; EnemySpawner activaba grupos por cameraX; CheckpointManager elegía el último checkpoint pasado en X. Boss activa su arena al pasar arenaLeft y su muerte completa el nivel. La cámara muestra 256×240 WORLD con framebuffer 512×480. Decoración determinista generada al cargar; parallax con tres assets/velocidades.

Ahora **`public/levels/level-01.json`** es la fuente canónica. `signalWorks.ts` solo importa y valida ese JSON. `LevelDocument.ts` contiene tipos, validation, import/export, `loadLevel(url)` y el punto central de migración. `Level` sigue construyendo geometría real y Game recibe datos por instancia, conservando los mismos sistemas de gameplay. El editor no contiene un segundo motor.

El snapshot previo se conserva únicamente como fixture en `tests/level-01-legacy.json`. Las pruebas comparan todos los valores anteriores, geometría, grupos, drops y timing. La decoración generada se materializó en JSON; `DecorationView` comparte SpriteVisual/TiledVisual/AssetManager entre editor/runtime. Capturas del inicio con datos anteriores y con JSON: idénticas píxel a píxel.

## Schema y coordenadas

```json
{
  "version": 1,
  "id": "level-id",
  "name": "Level name",
  "width": 2048,
  "height": 240,
  "spawn": { "id": "player-spawn", "x": 32, "y": 44 },
  "ground": [],
  "platforms": [],
  "spawnGroups": [],
  "checkpoints": [],
  "sections": [],
  "boss": { "id": "boss", "x": 1948, "y": 44, "arenaLeft": 1792 },
  "exitX": 1984,
  "automaticTerrain": true,
  "decorations": [],
  "backgrounds": [
    { "asset": "background.far", "speed": 0.15, "offsetX": 0, "offsetY": 0 },
    { "asset": "background.mid", "speed": 0.4, "offsetX": 0, "offsetY": 0 },
    { "asset": "background.near", "speed": 0.75, "offsetX": 0, "offsetY": 0 }
  ]
}
```

Ejemplo mínimo: añadir suelo antes de jugar. Usa los nombres que ya consume el runtime; no hay una segunda representación de gameplay.

| Datos | Contrato |
|---|---|
| Ground | `{id,x,y,width,height}`, bottom-left, sin colisión derivada de píxeles |
| Platform | Igual más `kind: solid / one-way`; height sigue existiendo porque runtime la utiliza |
| Spawn group | `{id,x,enemies:[]}`; pertenencia por contención, sin referencias huérfanas; sigue usando cameraX |
| Enemy | `{id,kind,x,y,facing?}`, soldier/runner/turret/flying, facing ±1 |
| FlyingEnemy | `weaponDrop: M / S / L`, u omisión para NONE; trayectoria existente sin cambios |
| Turret | `firingMode: aimed / horizontal` |
| Checkpoint | `{id,x,y,name}`, orden derivado de X |
| Boss | `{id,x,y,arenaLeft}`; región de preview 256×240, trigger real por X |
| Decoration | `{id,asset,x,y,width,height,layer,flipX,tiled}`, layers back/terrain/front |
| Backgrounds | FAR/MID/NEAR, asset, speed 0–1, offsets WORLD |

Decoration sprite: x es **bottom-center**. Decoration tiled: x es **left edge**. Medidas siempre WORLD; el manifest decide source pixels y densidad. Tiled solo para assets declarados tileable. El facing inicial no bloquea los cambios posteriores de dirección de la AI.

`automaticTerrain` aplica el kit modular existente a colliders. Desactivarlo permite vestir manualmente sin desactivar colisiones; los placeholders de sólidos siguen como fallback. Pintar TERRAIN crea visuales sin modificar colliders. `exitX` conserva el marcador existente; la victoria depende del boss.

IDs estables; nuevos objetos usan UUID. Reordenar arrays no cambia identidad. `parseLevel` es la frontera para futuras migraciones; hoy acepta versión 1 y rechaza desconocidas. `convertLegacyLevel` convierte explícitamente el formato anterior. Solo datos JSON, sin JS embebido.

## Herramientas

- SELECT: click, drag, Shift+click múltiple, propiedades por tipo. El drag previsualiza outline y aplica al soltar.
- PAN: drag; también middle/right drag en cualquier herramienta. Wheel: zoom al cursor. RESET VIEW y FIT LEVEL.
- TERRAIN: thumbnail real y click/rectángulo de tiles, sin colliders; métrica WORLD 16×16 o 16×8. Máximo 4096 piezas por operación.
- SOLID: arrastrar rectángulo. ONE-WAY: arrastrar horizontalmente; altura inicial 6 editable.
- PIT: recorta ground y abre un hueco sobre el kill plane existente; no introduce hazards nuevos.
- ENEMY: elegir tipo y grupo en “Place in trigger”, colocar y editar. Crear primero un TRIGGER si el nivel está vacío.
- TRIGGER: línea X editable; seleccionarla resalta sus enemigos. Eliminarla borra sus miembros en una sola operación deshacible.
- SPAWN: mueve el único spawn. CHECKPOINT: posición, nombre e ID.
- BOSS: posición y arenaLeft; conserva comportamiento/patrones.
- DECORATION: paredes, props, animados, tamaño, layer y flip. Tiled repite la textura.
- CAMERA: mueve exclusivamente el preview de 256×240, sin persistirlo en LevelData.
- Grid 16 y snap con toggle, visibilidad y bloqueo por capas, propiedades del mundo y FAR/MID/NEAR.

| Atajo | Acción |
|---|---|
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Y / Ctrl/Cmd+Shift+Z | Redo |
| Ctrl/Cmd+D | Duplicar con desplazamiento de 16 unidades |
| Ctrl/Cmd+C / V | Copiar selección / duplicar dentro del mismo documento |
| Delete / Backspace | Eliminar |
| Escape en editor | Limpiar selección |
| Escape en playtest | Volver al editor |

Atajos ignorados dentro de inputs/selects. Historial de **100 comandos**: campos afectados para movimientos/propiedades y colecciones afectadas para create/delete, sin snapshots de todo el nivel. Incluye pit cut, duplicate y reasignación de grupos. Spawn y boss no se eliminan ni duplican.

## Save / Load / Import / Export

SAVE LOCAL guarda un documento en localStorage. LOAD restaura ese guardado o carga el nivel seleccionado. EXPORT JSON descarga `{id}.json`: la fuente portable real. IMPORT JSON valida antes de sustituir el trabajo, con límite de 5 MB. Autosave opcional guarda recuperación tras cada operación; se restaura al regresar/refrescar. No escribe archivos del repo ni publica nada.

UNSAVED CHANGES indica modificaciones pendientes. Export/save marca guardado; salir con cambios activa la protección del navegador. Resize no elimina objetos: validation muestra los problemas.

Errores bloquean export/playtest: versión/tipos/IDs inválidos, spawn faltante, posiciones fuera del mundo, tamaños no positivos, enemy/drop incorrecto, arena de boss inválida, background incorrecto, assets no registrados. Warnings permiten continuar: trigger vacío, falta de suelo o extensión parcial más allá del mundo.

## Playtest y futuros niveles

PLAY FROM START valida y pasa el documento por sessionStorage a `./?playtest=1`, que instancia **Game real**. PLAY FROM HERE usa un spawn temporal derivado del preview de cámara, sin cambiar el spawn real. ESC/RETURN TO LEVEL EDITOR vuelve y recupera el borrador. La página del editor nunca instancia Player, EnemyManager, armas, combate ni Game.

Para crear Level 2 en el futuro (no creado en esta fase): NEW → id/name/width/height → sólidos/plataformas/spawn/triggers/enemigos/checkpoints/boss/arte → playtest → exportar. Copiar manualmente el JSON a `public/levels/level-02.json`; abrir `./?level=levels/level-02.json`, sin crear Level2.ts. Añadir una opción al selector HTML para incluirlo en la lista de niveles conocidos.

Nuevo tipo de enemigo: primero implementar tipo/factory en runtime; ampliar EnemyPlacement, validación y pequeña lista de kinds de la paleta. Registrar clips en assets.ts. El editor no inventa AI desde JSON.

Nuevo environment asset: registrar en ENVIRONMENT_ASSETS/ASSETS y colocar PNG en su ruta. La paleta descubre automáticamente las entradas environment; no duplica imágenes. NearestFilter, source/world, UVs y fallback siguen en el pipeline existente.

## Verificación y rendimiento

- **273 tests**, typecheck y build pasan; build release excluye level-editor.html. Permanece el warning previo de Three.js >500 KB.
- `node scripts/level-editor-check.cjs` (Playwright/Chrome con Vite en 5173): mover Soldier, agregar Runner y FlyingEnemy con Spread, plataforma, checkpoint y trigger; Undo/Redo; descarga/import JSON real; playtest editado, drop/recogida Spread, muerte/respawn/checkpoint, victoria y retorno/refresh. Instrumentación solo del test, sin globals de Game en producción.
- `node scripts/boss-run-check.cjs` sigue pasando: campaña, boss directo, pausa, game over, respawn y victoria.
- Build servido en 4173: menú, refresh directo, assets sin 404, playtest/ESC return y viewport de 700px comprobados.
- Inicio del juego en Chrome headless: legacy **59 FPS**, JSON **60 FPS**; ambos **79 draw calls, 14 texturas GPU, 39 geometrías**. Capturas idénticas. Es una medición acotada, no garantía para todo hardware/encuentro.
- Stress editor: **2000 tiles adicionales + 255 objetos**, carga ~**317 ms**, pan **60 FPS** en Chrome headless. Texturas reutilizadas; render por cambios. Editar entidades conserva la geometría/parallax; modificar terreno reconstruye su grupo.

## Límites y Fase 16.1

- Runtime horizontal SIDE_FOLLOW, height 240 fijo. No zonas LOCKED/VERTICAL_FOLLOW/AUTO_SCROLL/top-down porque CameraController todavía no las consume. Schema versionado para agregarlas luego.
- Triggers por X y pits por huecos en suelo, sin scripting, nuevas waves ni nuevos hazards. Boss obligatorio según el juego actual.
- Un recovery y un save local; sin servidor para escribir al repo ni catálogo dinámico de proyectos. FIT LEVEL cubre overview básico, sin minimap separado.
- Sin handles de resize, selección por rectángulo, brush continuo ni clipboard entre documentos. Dimensiones editables en Properties. El drag muestra outline; las animaciones de preview se muestran en su primer frame, sin simular AI.
- Fase 16.1 razonable: catálogo JSON, resize handles, selección por rectángulo, clipboard/brush y minimap. Zonas de cámara solo junto con soporte explícito de runtime y migración de schema. No implementar todavía Level 2 ni visual scripting.
