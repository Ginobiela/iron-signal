# Fase 17 — Gameplay Tuner

## Abrir y compilar

`npm run dev` → menú → **TOOLS · GAMEPLAY TUNER**, o `http://127.0.0.1:5173/gameplay-tuner.html`.
Es una entrada independiente de Vite: no instancia Game, Level ni sistemas de colisión. Tiene refresh directo y URLs relativas compatibles con subdirectorios.

- `npm run build`: production sin páginas de herramientas, sin carga de tuning persistido, sin comandos ni panel F3.
- `npm run build:devtools`: build explícito que incluye Tuner, Level Editor y Animation Viewer.
- `npm run build -- --mode release`: también excluye herramientas.

El flag central `import.meta.env.DEV_TOOLS` se define en `vite.config.ts`: solo true para modos `development` y `development-tools`. `src/config/devtools.ts` además lo deshabilita en tests. Los imports dinámicos del playtest tienen guardas de compilación, por lo que production no emite sus chunks. GitHub Pages publica deliberadamente el build `development-tools` mediante `npm run build:devtools`: incluye Level Editor, Animation Viewer y Gameplay Tuner. El build de release separado (`npm run build`) continúa sin herramientas.

## Auditoría y alcance

Antes de esta fase, el balance estaba mayormente en `constants.ts`; las armas copiaban su cadencia/daño/velocidad en campos readonly y Spread precalculaba los ángulos una sola vez. Player, AI, boss y cámara mezclaban lecturas directas de constantes con valores capturados al crear instancias. La duración de proyectiles era única y global. Los tests existentes mayormente ya comparaban contra esas constantes.

Se identificaron **63 parámetros/listas de balance existentes dentro del alcance expuesto**, representados por **66 controles**: el lifetime compartido de proyectiles se expresa ahora en cuatro controles independientes, uno por arma. No es una cuenta de todos los literales numéricos del motor. Los defaults no cambiaron; `constants.ts` permanece intacto.

Clasificación previa aplicada:

| Clase | Parámetros | Comportamiento |
|---|---|---|
| A / LIVE | Movimiento, gravedad, salto, cadencia, daño, velocidades de disparo, thresholds/timers, cámara/feedback | Próximo update/evento; conserva timers en curso y proyectiles existentes |
| B / RESPAWN | Salud de Soldier, Runner, Turret, FlyingEnemy | Al crear/resetear cada instancia; no cura enemigos existentes |
| C / RESTART | Vidas iniciales, salud máxima del boss | Reinicio explícito del nivel; nunca automático |
| D / no exponer | Timestep, pools, dimensiones de colisión, spawn/layout, IDs, epsilon, versiones, offsets de armas/sprites | Son invariantes o pertenecen a otras herramientas |

Player maxHealth es LIVE: aumentar el máximo no cura; reducirlo limita la salud actual. HEAL PLAYER es un comando separado. Los pickups nuevos toman el lifetime configurado; los ya activos conservan el suyo. El aviso de expiración sí cambia en vivo. Los proyectiles de enemigos mantienen su lifetime original y no heredan el override de Rifle.

## Arquitectura

`src/config/gameplay.ts` deriva los defaults de las configuraciones existentes, clona y congela profundamente `DEFAULT_GAMEPLAY_CONFIG`. La estructura es:

```text
player / game / weapons.{rifle,machineGun,spread,laser}
enemies.{soldier,runner,turret,flying} + daño compartido
boss / powerups / camera / feedback
```

`GameplayConfigStore` mantiene un snapshot inmutable y un mapa plano de overrides. Expone `get()`, `getOverrides()`, `setOverride()`, `resetOverride()`, `resetSection()`, `resetAll()`, `replace()`, `subscribe()` y `preset()`. Cada commit valida todo antes de publicar el snapshot; un import inválido no deja cambios parciales. Se eliminan del mapa los valores iguales al default. Los cambios no reescriben archivos TypeScript ni JSON del repositorio.

Los constructores reciben opcionalmente `GameplayConfigSource`; sin argumento usan `DEFAULT_CONFIG_SOURCE`. Game pasa la misma fuente a Player, armas, pickups, enemigos, boss, estado, cámara y contactos. No existe singleton mutable. Los getters de armas consultan el snapshot actual, y las rotaciones de Spread solo se recalculan cuando cambia su lista de ángulos.

La metadata `GAMEPLAY_SETTINGS` es el catálogo de UI/validación: path, label, categoría, rango, step, descripción, BASIC/ADVANCED y applyMode. La página completa y el panel compacto reutilizan `TuningControls`. Agregar un parámetro requiere conectarlo al consumidor real y registrar su metadata; no duplicar sus defaults en UI.

## Parámetros disponibles

| Categoría | Controles |
|---|---|
| Player (11) | maxHealth, initialLives, speed, jumpSpeed, gravity, invulnerabilityTime, fallGravityMultiplier, maxFallSpeed, coyoteTime, jumpBuffer, dropSpeed |
| Weapons (17) | Por arma: damage, fireRate en disparos/s, projectileSpeed, projectileLifetime. Spread: lista de angles; su longitud es pellet count |
| Enemies (18) | Salud de los cuatro; velocidad de Soldier/Runner/Flying; attackInterval en segundos y bulletSpeed de Soldier/Turret; daño compartido de contacto/bala; activationMargin; stopDistance; Runner jumpSpeed; Flying amplitude/frequency |
| Boss (16) | health; phase2Threshold/phase3Threshold; telegraphTimes/recoveryTimes/bulletSpeeds por fase; burstCount/burstInterval/attackTime/introTime |
| Powerups (2) | lifetime, warningTime |
| Camera / Feedback (2) | deadZone, shakeLimit |

Son **60 LIVE, 4 RESPAWN y 2 RESTART**. El lifetime LIVE afecta solo nuevos objetos. Cada fila muestra DEFAULT, CURRENT y su modo; las modificadas se marcan. Hay RESET por propiedad/sección/global, búsqueda que también encuentra ADVANCED, SHOW CHANGES y estado de overrides activos.

No se inventaron fire rate para Flying ni velocidad para Turret. El daño enemigo es compartido porque así funciona el gameplay real. No hay smoothing de cámara ni duración de drop-through en este proyecto. Se mantuvieron intactos efectos VFX, offsets, colisiones, layout, spawn y la secuencia de patrones del boss. No se expusieron SCORE, velocidades internas del engine, geometría ni límites de pools.

## Presets e intercambio

Presets iniciales: DEFAULT, GOD MODE, FAST GAMEPLAY, SLOW MOTION TEST y WEAPON TEST. SLOW MOTION TEST ajusta velocidades/gravedad; **no es time scaling** y no modifica el fixed timestep. GOD MODE eleva máximo/vidas/invulnerabilidad, pero no cura instancias existentes: usar HEAL PLAYER o reiniciar.

Los presets personalizados viven en `localStorage['iron-signal-dev-presets-v1']`, separado de saves del jugador. Se cargan solo al abrir el tuner; no se activan automáticamente en una partida normal. La sesión activa se conserva en `sessionStorage['iron-signal-dev-tuning-v1']` entre tuner y playtest en esa pestaña.

Formato exportado:

```json
{
  "version": 1,
  "name": "Fast Gameplay",
  "overrides": {
    "player.speed": 120,
    "player.gravity": 500
  }
}
```

Import verifica versión, nombre, allowlist de paths, tipo numérico finito, límites y campos enteros. Spread acepta 1–15 ángulos enteros únicos ordenados dentro de -80…80°. Threshold phase2 debe ser mayor que phase3; warningTime no puede exceder lifetime. No admite NaN/Infinity, speed cero, salud negativa ni paths arbitrarios. El archivo importado se limita a 100 KB.

COPY CONFIG JSON muestra/copía el snapshot completo resuelto para revisar nuevos defaults. Para adoptar un preset: exportarlo, revisar el diff, actualizar deliberadamente los valores de balance en la fuente canónica existente (`constants.ts`, o reestructurar su export en una tarea explícita), y ejecutar tests. No se aplica ningún patch automático; las pruebas de defaults detectarán esos cambios deliberados.

## Playtest, F3 y comandos

PLAYTEST LEVEL 1 usa el nivel real; PLAYTEST BOSS permite probar el boss directamente. Solo `?tuning=1` en un build developer restaura la sesión explícita. BACK/RETURN TO GAMEPLAY TUNER conserva overrides. Una partida normal, incluso en dev, usa defaults.

**F3** abre/cierra el panel, y también se puede abrir desde el badge DEV PLAYTEST. F1/F2 mantienen debug. PAUSE GAME WHILE OPEN viene activado y congela también timers de muerte/efectos, conservando el estado previo; desactivarlo permite observar ajustes en vivo. Los controles del overlay no envían teclas al gameplay. Cerrar con F3 o CLOSE devuelve el control.

El panel muestra gravedad, velocidad, salto, máximo de salud, daño Rifle y salud Soldier/Runner. LIVE GAME informa health/maxHealth/lives, posición, velocidad, arma, grounded, estado, enemigos/proyectiles y estado de cheats.

DEV COMMANDS se mantienen fuera de Config/JSON: HEAL PLAYER, KILL PLAYER, CLEAR ENEMIES (sin score ni drops), toggles de vidas infinitas/invulnerabilidad, dar cada arma, teletransportarse al checkpoint actual y reiniciar nivel. Heal no resucita un Player muerto. Reset All restaura tuning; los toggles de cheats son independientes y su estado permanece visible. Un restart aplica los valores RESTART y recrea enemigos, conservando overrides y los toggles explícitos.

## Tests y validación

Los sistemas no importan persistencia ni leen storage. Los tests sin fuente explícita usan defaults, aun si hay una sesión extrema en storage. Tests alternativos inyectan su propio `GameplayConfigStore`, sin contaminar otros. `tests/gameplay-tuning.test.ts` comprueba esa separación, inmutabilidad, validación atómica, resets, física, armas, Spread/pool, health/respawn, boss, pickups, contactos y cámara/shake.

```text
npm run typecheck
npm test
npm run build
npm run build:devtools
node scripts/gameplay-tuner-check.cjs
```

El check de navegador requiere Vite dev en :5173 y Chrome/Playwright del runtime instalado. Para release: ejecutar preview en :4173 y definir `RELEASE_CHECK=1` y `TUNER_URL=http://127.0.0.1:4173`. Verifica menú sin tools, ausencia de solicitudes a módulos de tuning, parámetros tuning/playtest ignorados y F3 desactivado. También se ejecutaron las regresiones de Boss Run y Level Editor. **299 tests en 20 archivos**, typecheck y ambos builds pasan. Se comprobó también el build developer en viewport móvil 390×844, sin overflow horizontal. Permanece el warning previo de bundle Three.js >500 KB. No se silenció ni eliminó ningún test.

Archivos nuevos: gameplay-tuner.html; config/gameplay.ts y devtools.ts; devtools/GameplayTuner.ts, TuningControls.ts, gameplayPresets.ts, gameplayPlaytest.ts, gameplay-tuner-main.ts y gameplay-tuner.css; tests/gameplay-tuning.test.ts; scripts/gameplay-tuner-check.cjs; este documento.

Archivos existentes ajustados: Game/main, GameStateManager, Player, las cuatro armas/Weapon, ProjectileManager, Enemy/EnemyManager/las cuatro clases enemigas, Boss, CombatSystem, PowerupManager/WeaponPickup/PowerupView, CameraController/ScreenShakeManager, Menu, entry del editor, Vite/package y README/documentación del editor. No se modificaron defaults, PNG ni JSON de niveles.
