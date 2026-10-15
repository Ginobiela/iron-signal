# Dynamic Lighting — Fase 21.0 + 21.1

Estado: **COMPLETE** dentro del alcance 21.0/21.1, validado el 14-10-2026. Este es el informe histórico de 21.0/21.1. La continuación y valores actuales de 21.2 están en [gameplay-lighting.md](gameplay-lighting.md). El archivo conserva su nombre para no romper referencias.

## Arquitectura

`Scene → RenderTarget 512×480 → Lightmap 256×240 (o 512×480) → Composite → Screen`.

LightingSystem reconstruye posiciones world con `camera.matrixWorld * camera.projectionMatrixInverse`. Suma falloffs coloreados al ambient, limita a 0–1 y multiplica la escena en espacio lineal; el composite convierte a sRGB. No cambia UVs/materiales de sprites ni gameplay. NearestFilter, cero mipmaps, antialias=false, pixelRatio=1 y canvas pixelated conservan el pixel art.

- **Static level lights:** hasta 32, cargadas desde LevelData. Persistentes, sin lifetime, con almacenamiento separado del pool temporal. No reducen la capacidad de muzzle/explosion.
- **Temporary lights:** 32 slots reutilizables. FxSpritePool notifica solo VFX aceptados; rifle/MG/spread/laser y explosiones small/medium usan los perfiles de 21.0. Al saturar se descarta la nueva luz, sin crecimiento ilimitado.
- **Attached lights:** no implementadas ni necesarias para 21.1. Misiles y bosses mantienen gameplay/arte existente.
- No se añadió culling: 5–10 luces por nivel mantuvieron ~60 FPS en la prueba local.

Disabled ejecuta directamente `renderer.render(scene,camera)`, sin ambient residual ni passes. Static definitions quedan disponibles para reactivar. Los dos targets se crean al primer uso y se reutilizan; resize solo reasigna si cambia drawing buffer. Se restauran target/info.autoReset en finally. Dispose libera targets, shaders, geometry, DOM/listeners de debug y luces del nivel.

## LevelData y validación

Schema **v1**, extensión opcional compatible. No hay migración destructiva: un documento sin `lighting` conserva el render anterior (disabled, ambient 1, sin luces).

```json
"lighting": {
  "enabled": true,
  "ambient": 0.62,
  "mode": "smooth",
  "quantizationLevels": 4,
  "lights": [
    {"id":"lamp-01","type":"point","x":336,"y":60,"radius":84,"intensity":0.55,"color":"#a9dbeb"}
  ]
}
```

`LevelLighting.ts` centraliza tipos/defaults/capacidades/validación. Ambient 0–1; mode smooth/quantized; quantizationLevels entero 2–5, obligatorio en quantized y opcional en smooth. Cada luz necesita ID único, type point, posición finita, radio >0 y ≤2048, intensidad 0–4, color hexadecimal #RRGGBB. LevelDocument comprueba además IDs globales y posición dentro del mundo. Máximo 32 static lights. Datos inválidos se rechazan antes de importar/playtest; validación del editor muestra errores y desactiva preview inválido sin romperlo.

LevelLoader/parseLevel preservan la configuración; Game la entrega a LightingSystem.loadLevel. Restart y respawn limpian temporales y reconstruyen estáticas/configuración canónica; panel de debug se sincroniza. Level change dispone la instancia anterior. No hay condiciones por levelId.

## Level Editor

LIGHT crea una point light. Selección/drag, ID/X/Y/radius/intensity/color, duplicate/delete y undo/redo reutilizan LevelEditorModel. Color usa input color. Helpers muestran centro y círculo de radio con color/selección.

Colocación/movimiento de luces son libres por defecto. LIGHT SNAP permite usar el toggle global de grid. Layers → Lights oculta helpers sin apagar el lightmap. LEVEL LIGHTING edita Enabled/Ambient/Mode/Quantization Levels. PREVIEW LIGHTING usa el **mismo LightingSystem real**, sin otro renderer. Los helpers siguen siendo overlay del editor, sin collider.

Export → Import preserva luces y ambient exactamente; PLAY FROM START/HERE usa los datos actuales por sessionStorage sin exportar ni reiniciar Vite. Recovery/Save Local del editor también incluyen lighting.

## Primera pasada

| Nivel | Static lights | Ambient | Modo | Intención |
|---|---:|---:|---|---|
| 1 | 5 | 0.78 | smooth | Jungla legible, focos cálidos en ventilación/instalaciones militares. |
| 2 | 6 | 0.62 | smooth | Consolas, infraestructura y aproximación al boss, cyan moderado/cálido/alarma roja. |
| 3 | 10 | 0.54 | smooth | Shafts, pasarelas, warning y arena industrial; mantener bordes visibles. |

Smooth evita anillos durante el platforming. Cada nivel puede elegir quantized de forma independiente; 4 niveles queda como valor editable. No se modificaron geometría, spawns, checkpoints, balance, AI, físicas ni PNG. Los tres JSON solo agregaron lighting.

## Debug / release

El core lighting funciona en **release**, con la configuración del nivel. UI, cheats y laboratorio siguen DEV_TOOLS only. Release con lighting=lab&tuning no muestra panel, Tools ni laboratorio; OFF/ON de la config cambia la imagen correctamente.

F6 muestra panel: enabled, ambient (paso 0.01), smooth/quantized, resolución, debug Player/Mouse/color/radio, warning fija opcional, bounds, freeze, camera probe, benchmark temporal y soak. Debug Player y warning están apagados por defecto. Métricas separan static/temporary; benchmark mide OFF y 0–32 temporales sobre el baseline estático del nivel. Camera probe solo es diagnóstico y restaura cámara; no prueba parallax.

`/?level=levels/level-03.json&lighting=lab` copia el nivel en memoria. isLightingLab central en main gobierna carga, aislamiento de campaña y score efímero: no avanza campaña, no modifica el récord ni escribe JSON. Queries legacy lab=high/low y playtest/tuning permanecen compatibles. F11 funciona incluso con foco en el panel.

## Validación reproducible

- `npm test`: **389 tests / 31 archivos**. Sin skip/only ni assertions eliminadas.
- `npm run typecheck`, `npm run build`, `npm run build:devtools`: correctos. Warning conocido de Vite por chunk >500 kB; no lint configurado.
- tests/lighting.test.ts: disabled/direct render, lifetimes, valores inválidos, slots/reuse/saturación, VFX, matrices XY/zoom, targets/resize/restauración/dispose y lab sin mutación del nivel original.
- tests/level-lighting.test.ts: roundtrip de los tres niveles, legacy sin lighting, parámetros/IDs inválidos, 32 static +32 temporary sin conflicto, cambio/reinicio, disabled/quantized y edición undo/redo/duplicate/delete/export.
- `node scripts/level-lighting-check.cjs`: UI real LIGHT/free placement/drag/properties/color, ambient, duplicate/delete/undo/redo, helpers vs preview, quantized, descarga/export/import y PLAY FROM HERE; configuración inicial de los tres niveles; panel sincronizado al reiniciar.
- `node scripts/lighting-check.cjs`: píxeles OFF/ON/OFF idénticos en escena inmóvil, ambient cero, 4 niveles reales (0/85/170/255), world-space XY, resoluciones, 120 renders sin crecimiento, resize/F11, lab sin avance/persistencia, gameplay/respawn/restart. Reutiliza en secuencia campaña 1→2→3, Level 2 y Level 3 con lighting ON; limpia luces/panel/canvas anteriores.
- `node scripts/level-editor-check.cjs`: regresión del editor previo, armas/drops/checkpoints/boss/playtest/recovery. Conteo esperado ahora incluye las 5 luces; conserva las demás assertions.

Playtest rAF local, Chrome 1100×900, 6 s por escenario, static lights + warning diagnóstico y dinámicas. Fixtures invulnerables para completar muestras, explosiones visuales inyectadas; Gate incluye destrucción de defensas para comprobar perros. No certifica balance humano ni hardware móvil.

| Escenario | FPS aprox. | Draw calls | Texturas | Geometrías | Máx. luces activas |
|---|---:|---:|---:|---:|---:|
| Level 1: Machine Gun/combate/explosiones | 60 | 78 | 33 | 85 | 9 |
| Level 2: chase/misiles/explosiones | 60 | 66 | 29–30 | 98 | 10 |
| Level 3: Gate/torretas/perros/explosiones | 60 | 83–84 | 28 | 60–61 | 15 |

Se revisaron capturas reales de los tres niveles y editor: sin problemas evidentes de alineación, blur o legibilidad. Cámara horizontal/vertical/transiciones/locked y boss retry/defeat/extraction pasan workflows existentes (Level 3: 44 saltos). No hay métrica visibleLights ni medición de tiempo/memoria GPU real. Targets estimados 2.11 MiB (mitad) / 2.81 MiB (completo).

`node scripts/lighting-check.cjs --soak` se repitió con static lights: 180 s, gameplay congelado y luces temporales de muzzle/explosion. 20 texturas, 53 geometrías y 5 programas constantes; 0 temporales tras expiración. Heap inicial/final ~28.1/28.8 MB, sin fuga evidente. No equivale a 3 minutos de combate completo.

Límites: todas las capas reciben el lightmap; HUD HTML queda fuera. Sin oclusión, sombras, normales, HDR, bloom, volumétricos, attached lights, nuevos VFX ni assets. Las static lights no hacen flicker ni controlan gameplay.

## Commit limpio (Fase 21 acumulada)

TRACKED MODIFIED:
level-editor.html; public/levels/level-01.json; public/levels/level-02.json; public/levels/level-03.json; scripts/level-editor-check.cjs; src/core/Game.ts; src/devtools/LevelEditor.ts; src/devtools/levelEditorModel.ts; src/level/Level.ts; src/level/LevelDocument.ts; src/main.ts; src/rendering/FxSpritePool.ts; tests/level-editor.test.ts.

NEW:
src/level/LevelLighting.ts; src/rendering/LightingSystem.ts; src/devtools/LightingPanel.ts; src/devtools/lightingLab.ts; tests/lighting.test.ts; tests/level-lighting.test.ts; scripts/lighting-check.cjs; scripts/level-lighting-check.cjs; docs/phase-21-lighting-spike.md.

UNRELATED CHANGE: src/bosses/FortifiedGateBoss.ts (offsets de torretas previos). Intacto, excluir del commit de iluminación.

UNRELATED UNTRACKED: outputs/gameplay-tuner.png; public/assets/environment/tiles/1jungle/; public/assets/environment/tiles/1military/; public/assets/sprites/enemies/1runner/; public/assets/sprites/enemies/1soldier/; public/assets/sprites/enemies/1turret/; public/environment/. Backups/copias previos, conservar fuera.

OPTIONAL OUTPUTS: outputs/phase-21-lighting/ (10 PNG +3 benchmark JSON +soak-180s.json de la sesión anterior). No se borraron ni se necesitan para el commit. Los scripts nuevos imprimen resultados; capturas de inspección se guardan en TEMP. El proyecto no versiona outputs.

Mensaje recomendado: `Complete data-driven level lighting and editor integration`.
Sin staging, commit ni push durante estas tareas.

FASE 21: COMPLETE
