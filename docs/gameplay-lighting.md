# Fase 21.2 — Gameplay-driven lighting y polish

Estado: **COMPLETE**, 14-10-2026. Extiende Fases 21.0/21.1; no reemplaza renderer ni introduce normal maps, sombras, bloom, HDR, volumétricos, nuevos assets o gameplay.

## Arquitectura y límites

- STATIC: hasta 32 luces persistentes de LevelData, con behavior opcional.
- TEMPORARY: 32 slots reutilizables; VFX aceptados notifican muzzle/explosion. Perfiles visuales en src/config/lighting.ts.
- ATTACHED: 16 slots reutilizables; `LightingSystem.attach(source, profile)`, con source `{position, active}`. Sigue world position + offsets, elimina referencias al desactivarse y reutiliza slot/Color. Pool lleno falla de forma segura. Disabled, loadLevel y dispose limpian attached.

LightingSystem no conoce Player, misiles, enemigos o bosses. CombatLighting es el adapter visual que observa el pool de proyectiles, visualFireCount, salud y estado de compuertas. No dispara, genera perros, daña, cambia IA ni controla la muerte. Sources de misiles/compuertas se crean una vez por Game; no hay allocations por frame de estas bindings, targets, shaders, geometría o texturas. Sigue el pipeline Scene → target → lightmap → composite, con uniforms acotados a 80 luces y vectores/colores reutilizados.

No se añadió culling: con las cargas observadas el juego mantuvo ~60 FPS. `visibleCount` cuenta intersecciones de radio/bounds de cámara X/Y; `submittedCount` incluye todas las activas. No elimina ni reubica datos. Los helpers del editor son independientes del lightmap. Imports con más de 32 static lights se rechazan; más de 24 generan warning de rendimiento.

## Integración gameplay/VFX

- Misiles homing: luz attached cálida de radio 18, intensidad 0.8, sin lifetime separado. El source consulta active/style del proyectil real, incluyendo reutilización del pool como bullet. Al expirar/impactar desaparece la luz; el callback de explosión existente crea VFX + luz small.
- Mecha: flash breve en el launcher al incrementarse visualFireCount; flash de daño al caer su HP; muerte usa explosión medium existente. Sin fuente gigante permanente ni cambios de ataques.
- Gate: torretas conservan el callback muzzle existente. OPENING/OPEN activa una luz attached interior por hatch (radio 24, intensidad 0.65, offset world +16/+12). CLOSED/CLOSING/death la apagan.
- Daño del boss: spark VFX existente y flash de luz breve, radio 24/intensidad 1.2/0.08 s. Varios impactos en un update se agrupan visualmente.
- Muerte del Gate: la lógica marca dead inmediatamente; la explosión medium original se complementa con small a +0.08 s, small a +0.18 s y medium a +0.30 s, en tres puntos configurados. Cuatro explosiones en total. Secuencia sin timers de navegador, limitada y cancelada en respawn/restart; no retrasa score, drops, vulnerabilidad o salida.
- Robot Dogs: sin emisor. No existe una luz por perro.

| Perfil | Radio world | Intensidad | Lifetime |
|---|---:|---:|---:|
| Rifle | 22 | 2.0 | 0.060 s |
| Machine Gun | 22 | 1.8 | 0.050 s |
| Spread | 30 | 2.2 | 0.070 s |
| Laser (cyan) | 26 | 1.8 | 0.065 s |
| Explosion small | 36 | 2.2 | 0.200 s |
| Explosion medium | 56 | 2.7 | 0.300 s |

Radios de explosión reducidos respecto al spike para corresponder mejor a VFX de 16/24 world units. Cadencia, daño y velocidad de armas intactos. No se necesitó refresh especial de muzzle MG: las vidas cortas reciclan el pool sin saturación en las cargas medidas.

## Behavior de nivel y arte

LevelLight mantiene schema v1 opcional compatible, agregando:

```json
{"behavior":"pulse","speed":0.7,"amount":0.18}
```

behavior: static (default), flicker o pulse. speed 0.1–20; amount 0–1. Defaults para behavior animado sin parámetros: speed 1/amount 0.2. Pulse es sinusoidal; flicker usa pasos y una fórmula determinista sin Math.random. Ambos modulan en `[1-amount,1]`, sin modificar la intensidad serializada. El tiempo avanza con el update visual y se congela con pausa. Load/restart reinician fase determinísticamente. El editor muestra speed/amount solo para flicker/pulse y anima el preview usando LightingSystem real; undo/export/import/playtest preservan parámetros.

| Nivel | Static lights | Ambient | Modo | Polish |
|---|---:|---:|---|---|
| 1 | 5 | 0.80 | smooth | Exterior claro; cálido militar, pulse mínimo en último foco. |
| 2 | 6 | 0.62 | smooth | Consolas cyan con pulse 12%; alarma roja 25%; misiles/launcher legibles. |
| 3 | 10 | 0.52 | smooth | Guía vertical fría, pulse 8% en shafts, consola/energía 18%, warning rojo con flicker 16%. |

No cambiaron geometría, spawns, checkpoints ni assets. Las posiciones de las luces estáticas se conservaron respecto a 21.1. Cantidades pequeñas y amplitudes contenidas mantienen plataformas, sprites y proyectiles visibles. Quantized sigue seleccionable por nivel, sin obligarlo.

## DEV controls y release

F6 conserva controles de 21.0/21.1 y agrega FULL AMBIENT, counts static/attached/temp, visible y submitted (no culling). FULL AMBIENT usa render directo sin borrar emisores; LIGHTING OFF también usa render directo y limpia fuentes dinámicas, que se reatan en el siguiente update visual al reactivar.

Gameplay Tuner quick panel F3 agrega Lighting intensity multiplier y Temporary light multiplier (0–2), FULL AMBIENT y LIGHTING ON. Son controles efímeros DEV, separados de GameplayConfig/defaults, presets y LevelData. No se guardan ni editan JSON. Global multiplier afecta intensidad de luces, no ambient. UI F3/F6 se sincroniza al editar/reiniciar. Release mantiene el core/emisores pero no panel, cheats, laboratorio ni controles de comparación; verificado también en navegador con boss chase.

## Validación

- **396 tests / 32 archivos**, typecheck, build y build:devtools correctos. Warning previo de Vite por chunk >500 kB; sin lint configurado.
- tests/gameplay-lighting.test.ts: follow/destroy/reuse/capacity/invalid attached; lifecycle con ProjectileManager real y bullet reuse; modulation determinista/en rango; hatch states, daño, muerte escalonada y reset; visual fire sin proyectiles/daño; FULL AMBIENT directo y overrides sin mutar datos.
- Tests anteriores conservados. Se actualizaron los valores esperados de ambient/perfiles para el polish autorizado; no se eliminaron assertions. Visibilidad conserva luces fuera de cámara en datos/submission.
- `node scripts/gameplay-lighting-check.cjs`: Level 1 desde spawn hasta x≈820 y checkpoint Puente Umbral, 4 kills; persecución Level 2 OFF/ON con 480 updates idénticos en posición/velocidad/HP/proyectiles (52 spawns), expiración de misil y luz/explosión; F3 sin cambios de LevelData; Gate fire/hatch/dogs/daño, cuatro explosiones exactas y reset sin eventos pendientes.
- `node scripts/level-lighting-check.cjs`: behavior/speed/amount, resto de LIGHT tool, preview, undo/redo, export/import y PLAY FROM HERE reales.
- `node scripts/lighting-check.cjs`: comparación de píxeles, mundo X/Y, fullscreen/resize, recursos estables, tres escenarios de gameplay, death/respawn/restart, campaña 1→2→3 y workflows completos de Level 2/3 (44 saltos, cámaras horizontal/vertical/locked, boss retry/defeat).

Muestras rAF de 6 s, Chrome local 1100×900, static + warning diagnóstico + dinámicas; fixtures protegidas para completar medición, sin cambiar defaults. Explosiones inyectadas y defensas del Gate destruidas para incluir hatches/dogs. No garantizan hardware móvil ni reemplazan revisión humana de balance.

| Escenario | FPS aprox. | Calls | Texturas | Geometrías | Max activas | Max attached | Max visibles | Max temporales |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| L1: MG/enemigos/explosiones | 60 | 77–78 | 33 | 85 | 9 | 0 | 3 | 4 |
| L2: chase/misiles/explosiones | 60 | 65–66 | 30 | 97–98 | 12 | 2 | 6 | 4 |
| L3: Gate/hatches/perros/explosiones | 60 | 83–84 | 28 | 60–61 | 15 | 1 | 8 | 4 |

No se suman los máximos por categoría: se capturaron en instantes distintos. No se midió tiempo GPU real. No hay allocations GPU recurrentes ni nuevos targets (siguen siendo dos). Se inspeccionaron capturas con assets cargados: sin blur/alineación/contraste problemáticos evidentes. El soak 180 s de 21.1 sigue documentado en su informe; no se presenta como un soak nuevo de attached. Lifecycles/reuse/saturación se validan en tests y gameplay actual.

Se corrigió un cleanup que dependía del siguiente render: CombatLighting ahora sincroniza las fuentes al observar cada update. No se detectaron regresiones de gameplay. La prueba del editor usa un amount distinto del default para comprobar persistencia explícita.

## Archivos y alcance

Nuevos: src/config/lighting.ts; src/rendering/CombatLighting.ts; tests/gameplay-lighting.test.ts; scripts/gameplay-lighting-check.cjs; docs/gameplay-lighting.md.

Extendidos respecto a 21.1: src/rendering/LightingSystem.ts; src/level/LevelLighting.ts; src/level/LevelDocument.ts; src/core/Game.ts; src/devtools/LightingPanel.ts; src/devtools/LevelEditor.ts; src/devtools/gameplayPlaytest.ts; public/levels/level-01.json; public/levels/level-02.json; public/levels/level-03.json; tests/lighting.test.ts; tests/level-editor.test.ts; tests/level-lighting.test.ts; scripts/lighting-check.cjs; scripts/level-lighting-check.cjs; docs/phase-21-lighting-spike.md.

El cambio previo de offsets en src/bosses/FortifiedGateBoss.ts permanece intacto y ajeno al commit de lighting. Backups de assets/public/environment y outputs previos permanecen fuera. Capturas QA en TEMP, sin generar assets. No staging, commit ni push solicitados/realizados.

Límites: sin oclusión/culling, todas las capas reciben luz; cámara ortográfica X/Y sin rotación en métricas de visibilidad; 32+32+16 slots; settings DEV efímeros. No se iniciaron normal maps, sombras, bloom ni Fase 22.

FASE 21.2: COMPLETE
