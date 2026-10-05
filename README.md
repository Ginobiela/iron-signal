# Iron Signal

Run-and-gun web original inspirado en el ritmo del género arcade de 8 bits. No incluye código, mapas, música ni gráficos de Contra. **Entrega actual: FASE 11 — Graphics pipeline y sistema de sprites.** El Complejo de Relevo tiene 9600 unidades de longitud, cuatro sectores y sala final, doce fosos, plataformas sólidas y one-way, 21 grupos de aparición y tres capas de parallax. Hay cuatro armas, seis portadores aéreos M/S/L entre diez voladores, tres vidas, seis checkpoints, score, récord persistente, menú, pausa, respawn, game over y un jefe original de tres fases: el Guardián Cenital. Derrotarlo completa la misión. Incluye sonidos originales sintetizados, partículas reutilizables, animaciones, flash de disparo, sacudidas breves y transiciones de interfaz. Las armas se obtienen destruyendo portadores: sus cápsulas caen físicamente. Collider y dimensiones visuales están separados; crouch permite esquivar tiros altos.

## Instalación y ejecución

Juego publicado: [Iron Signal en GitHub Pages](https://ginobiela.github.io/iron-signal/).

Repositorio: [Ginobiela/iron-signal](https://github.com/Ginobiela/iron-signal).

Requiere Node.js 22.12+ (o 20.19+) y npm.

```sh
npm install
npm run dev
```

Abre la URL que imprime Vite. Para comprobar y previsualizar la entrega:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

En PowerShell, si npm no está en el PATH, puedes usar `& 'C:/Program Files/nodejs/npm.cmd' install` y los mismos argumentos para los demás comandos.

### Publicación en GitHub Pages

El workflow `.github/workflows/pages.yml` publica automáticamente al hacer push a `master`. Usa Node 22, instala con `npm ci`, ejecuta tests y compila antes del despliegue. GitHub Pages debe tener Source = GitHub Actions en Settings → Pages. También se puede ejecutar manualmente desde Actions → Publish Iron Signal.

`vite.config.ts` usa base relativa `./` para que JavaScript, CSS y favicon carguen bajo `/iron-signal/` sin depender de la raíz del dominio. Solo se publica `dist`; el juego no necesita servidor de backend. Para agregar assets más adelante, usa rutas relativas al sitio o `import.meta.env.BASE_URL`, evitando rutas que empiecen en la raíz del dominio.

## Controles

| Tecla | Acción |
| --- | --- |
| A / ← | Correr a la izquierda |
| D / → | Correr a la derecha |
| W / ↑ | Apuntar arriba; combinar con dirección horizontal para diagonal |
| S / ↓ | Agacharse sobre suelo o plataforma; quedarse quieto y disparar más bajo |
| Space | Saltar; mantener no repite el salto |
| S + Space | Bajar de la plataforma one-way actual |
| J | Disparar el arma actual; mantener para repetir a su cadencia |
| Enter | Comenzar desde menú; nueva partida tras game over o completar la ruta; continuar desde pausa |
| F1 | Mostrar debug y bounding boxes |
| F2 | Mostrar sprite bounds, anchors y orígenes visuales |
| Escape | Pausar / reanudar la partida |

F1 muestra FPS, frecuencia de simulación, posición, velocidad, cámara, estado de partida y jugador, vidas, score, checkpoint, altura, soporte one-way, arma, apuntado, invulnerabilidad, enemigos activos y pendientes, triggers ejecutados, drops creados/activos/recogidos, proyectiles, impactos y bajas. Los contornos azules indican el collider de pie, ámbar el agachado y verde el activo; magenta indica colliders de proyectiles. Ambos colliders del jugador comparten los pies. Perder foco pausa una partida activa; cambiar de pestaña también suspende el loop. Al volver, Escape o Enter continúa con teclas limpias. Las letras M/S/L identifican la carga de los portadores y sus drops, no teclas de selección; S sigue siendo agacharse.

## Arquitectura y estructura

```text
src/
  main.ts                       Arranque y errores WebGL
  style.css                     Presentación y escalado
  config/constants.ts           Valores de movimiento, combate, cámara y parallax
  config/graphics.ts            Configuración de placeholders
  config/assets.ts              Manifest PNG/sheets/atlas, clips, visual config y Z layers
  core/Game.ts                  Composición y ciclo de vida
  core/GameLoop.ts               requestAnimationFrame y acumulador fijo
  core/InputManager.ts           Teclas sostenidas y pulsaciones por paso
  core/GameStateManager.ts       Estados, vidas y espera de respawn
  core/ScoreManager.ts           Puntos, formato y récord en localStorage
  core/AudioManager.ts           Síntesis Web Audio, volumen y ciclo de vida
  core/AssetManager.ts           Carga cacheada de texturas y audio originales
  bosses/Boss.ts                 Fases, blindaje, patrones y ciclo del jefe
  entities/Entity.ts             Cuerpo cinemático
  entities/Player.ts             Movimiento, salto, crouch y referencia al arma
  entities/WeaponPickup.ts       Drop con gravedad, colisiones, apoyo y caducidad
  entities/enemies/
    Enemy.ts                    Salud y helpers comunes
    Soldier.ts                  Persecución y disparos
    Runner.ts                   Carga y salto de obstáculos
    Turret.ts                   Apuntado estacionario
    FlyingEnemy.ts              Trayectoria ondulada
    EnemyManager.ts             Creación y actualización de enemigos
  collision/CollisionSystem.ts   AABB, resolución por ejes y plataformas
  collision/CombatSystem.ts      Contacto y primer impacto de proyectiles
  camera/CameraController.ts     Seguimiento horizontal con dead-zone
  camera/ScreenShakeManager.ts   Offset visual breve, limitado a dos píxeles
  level/Level.ts                 Datos y consultas del nivel
  level/Platform.ts              Plataforma sólida / one-way
  level/EnemySpawner.ts          Triggers de cámara de una sola ejecución
  level/PowerupManager.ts        Pool, drop único, recogida, cambio de arma y aviso
  level/Checkpoint.ts            Selección del último checkpoint alcanzado
  level/signalWorks.ts           Terreno, secciones y oleadas del Complejo de Relevo
  level/testLevel.ts             Fixture del recorrido antiguo para regresión
  level/gameplayLab.ts           Escenarios de desarrollo para tiros altos/bajos
  rendering/LevelView.ts         Representación del terreno y debug
  rendering/ParallaxBackground.ts Tres capas geométricas originales
  rendering/PlayerView.ts        Animación independiente de física
  rendering/SpriteAnimator.ts    FPS, loop, flip, onComplete y compatibilidad de clips
  rendering/SpriteVisual.ts      Planos/UV por instancia, anchors y fallback
  rendering/FxSpritePool.ts      FX animados reutilizables
  rendering/TiledVisual.ts       Fondos y tiles repetibles sin física
  rendering/ParticleManager.ts   Pool fijo, movimiento y expiración de partículas
  rendering/ParticleView.ts      Un InstancedMesh para chispas y explosiones
  rendering/ProjectileView.ts    InstancedMesh para balas
  rendering/EnemyView.ts         Representación y feedback
  rendering/PowerupView.ts       Cápsulas con letras geométricas originales
  rendering/PowerupIcon.ts       Indicador M/S/L compartido por portadores y pickups
  rendering/CheckpointView.ts    Banderas que cambian de color al activarse
  rendering/BossView.ts          Máquina original, compuertas y avisos de ataque
  rendering/viewport.ts          Escalado proporcional
  weapons/Weapon.ts              Cadencia e interfaz de disparo
  weapons/Rifle.ts               Rifle
  weapons/MachineGun.ts          Disparo rápido
  weapons/SpreadGun.ts           Patrón de cinco proyectiles
  weapons/Laser.ts               Disparo potente
  projectiles/Projectile.ts      Datos de bala
  projectiles/ProjectileManager.ts Pool de proyectiles
  ui/CombatHUD.ts                Score, vidas, arma, récord, sector y checkpoint
  ui/Menu.ts                     Menú, pausa, muerte y pantallas finales
  ui/BossHUD.ts                  Vida, fase y aviso de blindaje del jefe
tests/
  core.test.ts                   Timestep, stalls, entrada y escalado
  movement.test.ts               Movimiento, salto, sólidos y cámara
  shooting.test.ts               Apuntado, cadencia, pooling y barridos
  enemies.test.ts                IA, daño, propiedad de balas y reinicio
  level.test.ts                  One-way, crouch, fosos, triggers y recorrido
  weapons.test.ts                Nuevas armas, cadencia, saturación y pickups
  session.test.ts                Estados, vidas, score, persistencia y respawn
  boss.test.ts                   Fases, esquivas, colisión, arena y ritmo de combate
  feedback.test.ts               Pool, efectos, animación, impactos, audio y assets
  gameplay-polish.test.ts        Hitboxes, torretas horizontales, drops y física
public/assets/
  sprites/
  sounds/
  music/
```

### Simulación y render

La simulación usa pasos de 1/60 s, independientemente del render. El loop limita la recuperación a 0.1 s tras bloqueos. `render(alpha)` recibe la fracción acumulada para interpolación futura. Three.js solo representa: físicas y combate se ejecutan en `update()`.

OrthographicCamera usa X/Y para gameplay y Z para capas. El buffer permanece en 256×240, pixel ratio 1 y antialias desactivado. CSS escala por múltiplos enteros cuando hay espacio y reduce proporcionalmente en ventanas pequeñas. Las bandas libres preservan la vista en 16:9, 16:10 y 4:3. Las primitivas actuales no necesitan texturas; las futuras texturas de sprites usarán NearestFilter.

InputManager mantiene estado continuo y flancos de pulsación; no mueve entidades desde eventos. `endStep()` consume flancos después de que todos los sistemas los lean. El jugador tiene velocidad inmediata 95, salto 210, gravedad 600, caída ×1.2, coyote time 0.08 s y jump buffer 0.10 s. Las constantes se ajustan en `config/constants.ts`.

### Plataformas y cámara

CollisionSystem resuelve sólidos primero en X y después en Y, barriendo superficies para impedir atravesar suelo fino. Las one-way solo soportan al caer desde arriba: permiten pasar por debajo y por los lados. S + Space ignora exclusivamente la plataforma de apoyo y permite aterrizar en otra inferior. El jugador vuelve a poder saltar sobre la misma plataforma. Agacharse reduce la altura; no permite ponerse de pie dentro de un techo sólido. Las rejillas one-way dejan pasar balas; los sólidos las bloquean. Decoraciones no tienen collider.

CameraController mantiene al jugador cerca del 40% de la vista al avanzar, con dead-zone y límites de nivel, sin smoothing flotante. Permite retroceder al alcanzar el margen izquierdo. La física conserva decimales; representación y cámara se redondean a píxeles. El parallax usa velocidades 0.15, 0.40 y 0.75, con módulos geométricos repetidos y sin crear objetos por frame. La capa delantera queda por encima del recorrido para no tapar enemigos ni saltos.

### Armas y combate

Player mantiene aimDirection normalizada y una referencia Weapon. W solo apunta verticalmente; W con dirección horizontal apunta a 45°. Disparar no cambia la velocidad ni el salto. PlayerView anima y orienta el arma alrededor del mismo pivote que usa el disparo, incluida la postura agachada.

Weapon comparte cooldown en segundos y el disparo recto. SpreadGun solo especializa el patrón; Player mantiene una referencia común, sin lógica específica de arma.

| Arma | Cadencia (disparos/s) | Velocidad | Daño por proyectil | Patrón |
| --- | --- | --- | --- | --- |
| Rifle | 6 | 320 | 1 | Uno recto |
| Machine Gun (M) | 12 | 360 | 1 | Uno recto, mayor cadencia |
| Spread Gun (S) | 4 | 280 | 1 | Cinco a −30°, −15°, 0°, 15°, 30° relativos al apuntado |
| Laser (L) | 2 | 480 | 3 | Uno potente, estela celeste alineada con la dirección |

Todas permiten disparar horizontalmente, arriba o en diagonal mientras corres, saltas o te agachas. Laser se detiene en el primer enemigo o sólido; no atraviesa objetivos. Su estela alargada es visual, mientras el barrido usa el mismo tamaño de impacto de 3 unidades que las demás balas. Los valores están en config/constants.ts.

ProjectileManager reserva 96 objetos, reutiliza sus datos y recicla al impactar, salir de los límites o agotar 2 s de vida. Si no hay espacio, el arma no consume cooldown por un disparo fallido. Spread requiere cinco slots libres para emitir la salva completa; no dispara salvas parciales. El estilo visual se restaura al reutilizar slots para que un tiro normal no herede la estela del Laser. ProjectileView usa un InstancedMesh y una transformación reutilizada. Las balas normales del jugador son crema y las enemigas rojas.

Las cápsulas M/S/L cambian el arma automáticamente al tocar la hitbox activa del jugador y se desactivan al recogerlas. Un aviso de 1.5 s confirma la recogida y el HUD conserva el nombre del arma. La nueva arma puede disparar en el mismo paso de recogida si J sigue presionado; los proyectiles que ya estaban en vuelo conservan su daño y trayectoria. No hay munición limitada ni armas estáticas en el suelo.

Solo ciertos FlyingEnemy incluyen `weaponDrop: 'M' | 'S' | 'L'`. El indicador M/S/L cuelga del cuerpo y usa PowerupIcon; no depende de las clases de armas. Los seis portadores aparecen en los triggers x=0, 580, 2400, 4800, 6500 y 8720. Los cuatro voladores restantes no sueltan armas. Dispara al cuerpo del portador: la cápsula colgante es un indicador visual.

CombatSystem ya notificaba bajas por daño; Game reutiliza ese callback para llamar a `PowerupManager.dropFromEnemy()`, sin duplicar muerte ni score. Un WeakSet evita repetir drops del mismo enemigo. El retiro de enemigos fuera de pantalla no concede armas ni puntos. El drop nace exactamente en las coordenadas finales `enemy.position.x/y`, sin redondeo ni traslado al terreno; comienza a moverse en el siguiente paso, por lo que se representa primero en su origen de muerte.

WeaponPickup añade posición, velocidad, gravedad, grounded, active, kind y tiempo restante. Su collider es 12×12, independiente de la cápsula visual 14×14. El impulso inicial es +35 vertical y hasta ±10 horizontal; gravedad 420 y caída máxima 240. Usa `CollisionSystem.move()` para sólidos y one-way: solo aterriza en estas últimas desde arriba. Al apoyarse, la velocidad vertical queda en cero y se detiene la deriva horizontal. Dura 10 s y parpadea durante los últimos 2 s; al caer a un foso se retira. Todo se configura en POWERUPS. Doce slots y sus iconos se crean una sola vez; al saturar el pool no se crean más objetos.

Pausa y PLAYER_DEAD congelan caída y caducidad. Respawn conserva drops y bajas, sin volver a entregar armas de portadores destruidos. Una nueva partida vacía el pool, contadores y registro de drops.

### Hitbox de crouch

La implementación anterior sí reducía el collider, pero solo de 26 a 16 píxeles. Un proyectil centrado 16 píxeles sobre los pies todavía intersectaba la caja, incluyendo su radio de 1.5 píxeles. Las torretas dirigidas también recalculan el centro actual del jugador, por lo que pueden apuntar bajo: crouch no debe evitar todos los ataques.

PLAYER_COLLISION ahora define standing=12×26 y crouching=12×12. `Player.position` conserva la esquina inferior izquierda y reducir altura no modifica y. `standingBounds`, `crouchingBounds` y `collisionBounds` son AABB reutilizadas; CombatSystem y PowerupManager consultan la caja activa. Crouch no modifica salud ni invulnerabilidad. `canStandUp()` reutiliza la consulta de espacio libre de CollisionSystem: bajo un techo sólido mantiene la postura reducida hasta tener espacio.

Con suelo y=44, un tiro horizontal y=60 golpea de pie y pasa sobre crouch; y=52 sigue dañando al jugador agachado. El disparo conserva su radio real. El collider sigue siendo independiente del estado visual/animación, incluida la postura bloqueada bajo techo.

Para comprobarlo con una torreta real durante `npm run dev`:

- Abre [laboratorio alto](http://127.0.0.1:5173/?lab=high), pulsa Enter y espera de pie: recibirás daño. Recarga, pulsa Enter y mantén S: el mismo tiro pasa por encima.
- Abre [laboratorio bajo](http://127.0.0.1:5173/?lab=low), pulsa Enter y mantén S: el tiro bajo sí golpea.
- F1 muestra contornos y proyectiles. Ambos escenarios utilizan Turret, ProjectileManager y CombatSystem originales; únicamente cambia el terreno y `firingMode: 'horizontal'`. Las torretas de campaña conservan su apuntado dirigido.

Los laboratorios solo se habilitan con Vite en desarrollo. En build/preview esos parámetros abren la campaña normal.

CombatSystem selecciona el primer impacto entre sólidos y blancos válidos a lo largo del segmento barrido, incluyendo el cañón al nacer. Una pared protege lo que hay detrás; cada bala daña un solo blanco. No hay fuego amigo y los cadáveres no absorben balas.

| Enemigo | Comportamiento | Salud | Aspecto |
| --- | --- | --- | --- |
| Soldier | Se acerca y dispara cada 1.6 s | 2 | Humanoide verde |
| Runner | Carga a 80 unidades/s y salta obstáculos | 1 | Rojo, cuerpo bajo |
| Turret | Apunta y dispara cada 1.25 s; avisa con cañón rojo | 5 | Base dorada |
| FlyingEnemy | Cruza a la izquierda con trayectoria sinusoidal | 2 | Alas violetas |

Cada comportamiento tiene su propia clase. Los impactos producen flash y barra de salud parcial; al morir el enemigo desaparece. Audio, partículas y explosiones se incorporarán en polish.

### Nivel y reinicio

`signalWorks.ts` define terreno segmentado, plataformas, checkpoints, secciones y grupos `{ x, enemies }`. Las armas se configuran como carga opcional de enemigos aéreos, sin un array de pickups estáticos. EnemySpawner crea realmente los enemigos cuando la cámara alcanza cada trigger; no hay instancias de oleadas futuras. Cada trigger se ejecuta una vez, incluso al retroceder o reaparecer, y se restaura al iniciar una nueva partida. Los enemigos fuera de la ventana se suspenden; los que quedan muy atrás se retiran para evitar actividad innecesaria.

Los fosos de 40–44 unidades y los desniveles son superables con el movimiento actual. El recorrido sin detenerse requiere aproximadamente 101 segundos; la duración con combate depende del jugador. El objetivo global es 3–5 minutos incluyendo el jefe. Cruzar el acceso final no gana la partida: hay que derrotar al Guardián Cenital para activar LEVEL_COMPLETE.

La partida empieza con **3 vidas**. Un impacto de enemigo o proyectil consume una vida; los fosos matan incluso durante invulnerabilidad. PLAYER_DEAD congela el mundo durante 0.65 s. Con vidas restantes, el jugador reaparece automáticamente en el último checkpoint con Rifle, movimiento limpio y 1.5 s de invulnerabilidad con parpadeo. Las balas se limpian, pero score, bajas, drops, cápsulas recogidas y triggers se conservan: no se duplican enemigos ni puntos. Sin vidas, pasa a GAME_OVER. Enter inicia otra partida y restaura nivel, vidas, pool de drops, cámara, checkpoints, score y contadores.

Los checkpoints son banderas en x=620, 2400, 4800, 7200, 9088 y 9344. El último está en la entrada de la sala del jefe. Se activa el más avanzado que haya cruzado un jugador vivo al tocar suelo o plataforma; retroceder no reemplaza un checkpoint por otro anterior. El aviso y la bandera amarilla confirman la activación. Los puntos de respawn están sobre suelo seguro.

GameStateManager concentra BOOT, MENU, PLAYING, PAUSED, PLAYER_DEAD, GAME_OVER y LEVEL_COMPLETE. Game solo actualiza físicas, armas, enemigos, pickups y checkpoints en PLAYING; PAUSED mantiene sus timers y animaciones congelados. Entrar desde menú o terminal reinicia la partida, y Enter durante PLAYING no reinicia accidentalmente. Escape también limpia teclas para evitar disparos o saltos pendientes al continuar.

CombatSystem informa una baja de proyectil una sola vez. ScoreManager suma 100 por Soldier o Runner, 200 por Turret, 300 por FlyingEnemy y 5000 por el jefe. Los enemigos que caen o se retiran fuera de cámara no dan puntos. HUD usa ocho dígitos, por ejemplo 00012500. El récord se guarda en localStorage como `iron-signal.highScore`; errores o bloqueo de storage conservan el juego funcional con récord en memoria. Nueva partida pone score a cero y conserva récord.

### Guardián Cenital

Boss es independiente de los enemigos normales y comparte con ellos el barrido de impactos de CombatSystem. Su máquina y cápsulas están construidas con geometría plana original. Al pisar la entrada x=9344, se activa el checkpoint, se limpian las balas anteriores y la cámara fija la sala de 256 unidades. CollisionSystem limita al jugador entre la puerta y el cuerpo del jefe; no se puede escapar ni atravesarlo. La torreta de aproximación está fuera de la sala para que sus ataques no se mezclen con los del jefe.

El jefe tiene 150 de vida y blindaje cerrado durante introducción, aviso y ataque. Entre salvas abre sus compuertas: el núcleo amarillo y el mensaje BLINDAJE ABIERTO indican cuándo los disparos hacen daño. Los tiros bloqueados desaparecen y producen flash de escudo, sin descontar vida. La barra accesible muestra vida, fase y tipo de aviso.

| Fase | Activación | Ataques y respuesta |
| --- | --- | --- |
| 1 | Más del 66% de vida | Alterna dos tiros altos y dos bajos. Agáchate ante los altos y salta los bajos. El emisor correspondiente se enciende antes de disparar. |
| 2 | 66% o menos | Dos abanicos de tres proyectiles apuntan a la posición capturada al iniciar el aviso. Cambia de posición; los proyectiles no persiguen al jugador. |
| 3 | Menos del 30% | Alterna salvas altas, bajas y dirigidas con avisos más cortos y proyectiles más rápidos. |

Cada cambio de fase concede una nueva introducción de 1 s. El jefe y sus timers se congelan al pausar o durante PLAYER_DEAD. La pausa conserva los proyectiles; morir los limpia. Al reaparecer en x=9344, mantiene vida y fase, vuelve a avisar durante 1 s y el jugador conserva los 1.5 s de protección. La batalla no se reinicia por perder una vida. Derrotarlo otorga 5000 puntos una vez, limpia las balas y muestra MISIÓN COMPLETA; una nueva partida lo restaura completamente.

El objetivo de ritmo es 30–60 s. Las pruebas de disparo continuo estacionario con Rifle y Laser entran en ese intervalo usando protección del jugador solo en la prueba para medir ventanas de daño. El combate real varía según esquivas, fallos, arma y muertes; Machine Gun puede acelerar la batalla. Los valores de salud, umbrales, tiempos y velocidades se ajustan en config/constants.ts; la colocación se define en `signalWorks.boss`.

Recursos Three.js se liberan al reiniciar o recargar módulos con Vite. No se incluyen React, motor físico, ECS ni assets externos.

## Sonido y feedback

AudioManager crea AudioContext tras una tecla o pulsación del usuario. Genera sonidos originales mediante osciladores y envolventes: disparo, Laser, salto, impacto, explosión, muerte, cápsula, checkpoint, blindaje, aviso del jefe y victoria. No hay archivos de sonido obligatorios ni música de terceros. Si el navegador bloquea o no ofrece audio, el juego continúa. Limita a 16 voces simultáneas y evita repetir impactos en menos de 40 ms; los nodos se desconectan al terminar. Pausar o perder foco corta los sonidos activos; los eventos anteriores no se reproducen al reanudar.

El control SONIDO ajusta el volumen entre 0 y 1; cero silencia. Guarda `iron-signal.audioVolume` en localStorage junto al récord existente. Las flechas ajustan el slider sin mover al jugador; Escape, Enter y F1 conservan sus atajos. El volumen inicial es 35% cuando no hay una preferencia válida.

CombatSystem comunica el punto exacto del impacto barrido a Game. Las chispas aparecen sobre enemigos, blindaje o escenario; una baja añade una explosión y puntos una sola vez. ParticleManager reutiliza 192 partículas y ParticleView un único InstancedMesh; saturar el pool descarta efectos visuales sin alterar balas o daño. Los efectos siguen el timestep fijo. La pausa los congela; durante muerte y victoria terminan de disiparse y una nueva partida los limpia.

ScreenShakeManager añade un offset entero solo a la cámara de render: no modifica controles, colisiones, posición del jugador ni triggers. Muertes, explosiones y cambios de fase del jefe producen una sacudida de 0.16–0.3 s con límite de 2 píxeles lógicos. Disparar normalmente no sacude la pantalla. La preferencia del sistema `prefers-reduced-motion` desactiva sacudidas y transiciones CSS.

SpriteAnimator reproduce clips con índices de frames independientes de la física. PlayerView usa esos frames para pasos de carrera discretos, poses aéreas y agachadas; el cañón añade un flash de 55 ms y retroceso visual de un píxel cuando se emite un disparo real. Mantener J durante cooldown o con el pool lleno no genera flashes falsos. Enemigos y jefe conservan sus flashes de daño y advertencias. Menús y avisos tienen entradas breves que no retrasan el control.

Los parámetros de intensidad, duración, pool y animación están en FEEDBACK y AUDIO de config/constants.ts. Los gráficos siguen siendo geometría plana original: esta fase mejora la respuesta del juego sin sustituir el arte por recursos complejos.

## Preparación del graphics pass

La lógica no importa Three.js ni calcula hitboxes desde sprites. PLAYER_COLLISION/POWERUPS/ENEMIES describen gameplay; config/graphics.ts contiene PLAYER_VISUAL, PICKUP_VISUAL, ENEMY_VISUALS y PLAYER_ANIMATIONS. Cambiar width/height/offsets visuales solo cambia la representación, manteniendo posición física, colisiones y pies.

Todas las posiciones de gameplay conservan la esquina inferior izquierda del collider para reutilizar la física existente. Los orígenes **visuales** son bottom-center para Player, Soldier, Runner, Turret y WeaponPickup; FlyingEnemy usa center. Las vistas convierten la posición física a ese anchor. Los offsets desplazan únicamente el dibujo, nunca los contornos debug ni el disparo. Las dimensiones originales del placeholder solo normalizan su geometría dentro de la vista; no se derivan de su collider.

PlayerView selecciona `idle`, `run`, `jump`, `fall`, `crouch`, `shoot`, `runShoot`, `jumpShoot` y `crouchShoot`, junto con `facing: 'left' | 'right'`. SpriteAnimator sigue devolviendo índices de frames independientes del movimiento. Ahora los clips comparten poses de placeholder; el manifest ya permite asignar frames distintos por clip y dirección sin cambiar Player. AssetManager ya carga texturas originales con NearestFilter y sin mipmaps, y conserva su caché y liberación de recursos. PowerupIcon centraliza M/S/L para sustituir el indicador tanto en portadores como en drops. Esta entrega no genera ni reemplaza arte definitivo.

## Extender el juego

- **Enemigos:** extender Enemy e implementar `updateBehavior(dt, context)`. Restaurar timers propios en `resetBehavior()`. Añadir EnemyKind, constructor al registro de EnemyManager, representación a EnemyView y emplazamientos en los spawnGroups del nivel. La lógica no debe importar Three.js.
- **Armas:** extender Weapon, definir nombre, cadencia, velocidad y daño e implementar `emit()` delegando balas al pool. Asignar la nueva instancia a `player.weapon`; Player no necesita condiciones específicas por arma.
- **Niveles:** crear otro objeto que satisfaga LevelData: width, spawn, ground, platforms, spawnGroups, checkpoints, boss, sections, exitX y name. Para portar armas, colocar `{ kind: 'flying', x, y, weaponDrop: 'M' | 'S' | 'L' }` en un grupo; omitir weaponDrop para un volador ordinario. Distribuirlos sobre superficies alcanzables, evitando que los drops habituales caigan a fosos. Cada checkpoint usa `{ x, y, name }`; verificar que su collider esté sobre terreno seguro y fuera de sólidos. Boss usa `{ x, y, arenaLeft }`; situar la sala en las últimas 256 unidades y un checkpoint en su entrada. Reutilizar Level y LevelView. El trigger x usa la posición izquierda de cámara, no la del jugador. Separar fosos entre segmentos de ground y verificar su alcance con pruebas de recorrido.
- **Assets:** añadir recursos originales a public/assets. AssetManager ofrece `texture(url)` con NearestFilter, sin mipmaps y color sRGB, y `sound(url, audioContext)` con caché y reintento tras errores. Sus promesas propagan fallos al llamador; `dispose()` libera texturas. SpriteAnimator entrega índices que pueden mapearse a celdas de una sprite sheet. El juego conecta ahora AssetManager a todas las vistas; los IDs activados mediante url en config/assets.ts se precargan una vez y getTexture/getSpriteSheet consultan el registro. Recursos sin url o faltantes mantienen placeholders; ninguna entidad carga archivos.

**FASE 10 implementada.** El graphics pass puede sustituir los placeholders usando la configuración visual y los anchors documentados; conviene conservar estas pruebas de gameplay durante ese trabajo.

## Validación

Las 238 pruebas cubren entrada, AABB, cámara, movimiento, coyote time, buffering, cooldown, pooling, barridos, cuatro comportamientos enemigos, daño, invulnerabilidad y reinicio. También prueban one-way, crouch, fosos, triggers, parallax, recorrido de 9600 unidades en ambos sentidos, patrones de armas, saturación de Spread y pickups. Session comprueba vidas, estados, score y persistencia. Boss añade blindaje, transiciones, patrones, captura de apuntado, esquivas, body contact, primer impacto entre blancos, 5000 puntos sin duplicados, respawn de la batalla, límites de arena y ritmo. Las regresiones integran GameLoop a 30, 60 y 144 Hz para comprobar que la simulación no depende del render, incluidos los ataques del jefe y la caída de pickups. Feedback verifica reutilización y saturación del pool, pausa, límites y expiración de shake, clips, punto de impacto, apertura y limpieza de audio, mute, persistencia, restricciones del navegador y caché/reintentos de assets. Gameplay polish añade hitboxes con pies compartidos, tiros altos/bajos a través del combate real y torretas del laboratorio, techos, drops únicos por M/S/L, voladores sin carga, aterrizaje estable, caducidad, fosos y recogida. Las pruebas antiguas de pickups usan ahora drops dinámicos y verifican que la campaña comienza sin cápsulas en suelo.

Para la comprobación manual:

1. Comprueba que el menú no permite mover ni disparar hasta Enter. Después corre, salta y dispara con varias teclas; verifica frenado inmediato y apuntado arriba/diagonal.
2. Salta bajo la primera rejilla celeste y aterriza encima; pulsa S + Space para bajar y vuelve a saltar sobre ella.
3. Agáchate con S, dispara y comprueba que el cañón y el collider bajan juntos.
4. Salta el bloque sólido y el primer foso hasta activar la bandera de x=620. Déjate caer después: debe restar una vida y reaparecer en x=620, con Rifle y protección breve.
5. Con F1 observa SPAWNS al avanzar; retroceder no debe repetir oleadas. Comprueba tres capas desplazándose a diferentes velocidades.
6. Recorre los sectores hasta la sala final. Comprueba que se activa su checkpoint y la cámara queda fija. Observa las salvas, esquiva y dispara cuando abre el blindaje. Verifica fases 2 y 3 al reducir su vida.
7. Pausa con Escape mientras disparas: enemigos, balas, física y timers deben quedar congelados. Reanuda con Escape o Enter. Cambia de pestaña y comprueba pausa automática; redimensiona a 16:9, 16:10, 4:3 o ventana pequeña.
8. Destruye portadores M/S/L durante el recorrido: comprueba aparición en el punto de muerte, impulso, caída y aterrizaje. Recoge el drop para equipar el arma, recibir aviso y actualizar HUD. Mantén J: Machine Gun dispara más seguido, Spread abre cinco trayectorias y Laser produce una estela celeste con menor cadencia. Prueba cada arma en horizontal, arriba, diagonal y agachado.
9. Agota las tres vidas y comprueba GAME OVER. Enter debe iniciar otra partida con score cero, tres vidas, todos los pickups y checkpoints iniciales. Recarga y verifica que el récord permanece.
10. Comprueba que una baja otorga puntos una vez y que muerte, retiro de enemigos y respawn no duplican score ni oleadas.
11. Muere durante el jefe: debe conservar su progreso y reaparecer con Rifle y protección. Derrótalo: deben sumarse 5000 puntos una vez, limpiarse las balas y aparecer MISIÓN COMPLETA. Enter restaura el jefe para otra partida.
12. Comprueba consola sin errores. El FPS de GPU depende del dispositivo; el timestep permanece a 60 Hz.
13. Pulsa Enter para habilitar audio. Dispara, salta, mata enemigos y recoge una cápsula: comprueba sonidos, flash y partículas. Pausa durante una explosión: los efectos deben congelarse y el sonido cortarse. Reanuda y verifica que desaparecen sin dejar offset de cámara.
14. Ajusta SONIDO, prueba cero y recarga: el volumen debe mantenerse. Activa movimiento reducido en el sistema: las sacudidas y transiciones deben desactivarse. Verifica que el juego sigue funcionando aunque AudioContext no esté disponible.
15. Deja un drop sin recoger: debe parpadear a los 8 s y desaparecer a los 10 s. Pausa durante la caída: posición, velocidad y tiempo restante se congelan. Un volador ordinario no deja cápsula.
16. Abre ambos laboratorios y verifica tiro alto de pie HIT, alto agachado MISS y bajo agachado HIT. F1 permite comparar collider activo, standing, crouching y proyectiles.


## Fase 11: pipeline gráfico

El contrato completo está en [art-reference/sprite-spec.md](art-reference/sprite-spec.md).
Se incluyen los PNG definitivos normalizados de Player idle/run/crouch; el resto conserva los placeholders de las
fases anteriores. El pipeline ya acepta PNG simples, strips, grillas y atlases sin
cambiar Player, Enemy, armas, físicas, colliders o datos de nivel.

Para agregar un sprite, copiarlo a la carpeta prevista y definir `url` en su entrada
`src/config/assets.ts`; `path` por sí solo documenta un archivo futuro. Para agregar
una animación, registrar su ID, sheet, visual y clip (`frames`, `frameRate`, `loop`,
`onComplete` opcional). Las vistas seleccionan estados visuales desde gameplay y
mantienen fallback para clips incompletos. Cada instancia tiene UV propias sobre una
textura compartida. No se usan texture.offset ni copias de textura por frame.

Player y enemigos terrestres usan bottom-center; FlyingEnemy/proyectiles/FX usan
center. width/height/offsetX/offsetY/scaleX/scaleY del manifest son visuales y el flip
no cambia colliders ni origen del disparo. `includesWeapon` permite sustituir el cañón
geométrico con arte; las variantes `player.<estado>_horizontal/_diagonal/_up` son
opcionales. PowerupIcon usa el mismo recurso tanto en portadores como en drops, con
M/S/L como fallback y una oscilación visual leve en el aire. Las muertes lógicas
siguen siendo inmediatas; las vistas pueden conservar su animación sin contactos.

F1 conserva el debug físico; F2 agrega contornos cyan de sprites, anchor amarillo y
origen magenta. Sprite sheets recomendadas: PNG RGBA sin trimming, celdas uniformes;
Player run 192×32, seis frames de 32×32 a 10 FPS. Player admite canvas 32×40;
Soldier 32×32, Runner/Turret 24×24, Flying 32×24, pickups 16×16. Generar primero
Player idle/run/crouch, Soldier idle/run, Flying fly y cápsulas M/S/L.

Las tres capas de parallax aceptan PNG tileables y el entorno admite ground/platform,
bordes, vegetación y decoraciones sin definir física. DRAW centraliza las capas Z.
FX opcionales se reutilizan en un pool de 24 visuales; los proyectiles mantienen su
pool y su representación instanciada cuando faltan texturas. Se mantienen 256×240,
NearestFilter, mipmaps desactivados, pixelRatio 1, antialias false y escalado sin deformación.

Los tests gráficos verifican scheduling, finalización única, UV con padding/atlas,
strips incompletos, anchors, carga compartida/fallback, independencia entre instancias,
colliders independientes del PNG y muerte visual sin entidad lógica activa.
### Primer arte definitivo del Player

Se integró la hoja adjunta de 1536×1024 RGBA como tres strips de celdas 32×32:
idle 128×32 (4 frames, 6 FPS), run 192×32 (6 frames, 11 FPS) y crouch 64×32
(2 frames de entrada a 7 FPS, mantener segundo). El source se conserva sin modificar
en `art-reference/player/source.png`, junto al [informe de normalización](art-reference/player/README.md)
y `normalization.json`, que registra recortes, alpha, ejes y baselines.

La extracción por componentes separa las poses aunque sus bboxes se solapen. La
escala común es 1/14, nearest neighbor y alpha binario; cada frame conserva el mismo
anchor (16,32). La vista usa 32×32, offsets 0/0 y flipX; los colliders siguen 12×26
/ 12×12. Las poses sin arte usan sus placeholders orientables.
`includesWeapon` evita duplicar el rifle.

`python scripts/normalize-player.py` reproduce los derivados con Pillow/NumPy y
verifica número de frames, baseline, clipping e integridad del source. Python no es
necesario para npm install/dev/build. La prueba player-art verifica crouch/flip,
colliders intactos y fallbacks de disparo/salto con las nuevas texturas.
### Nuevas animaciones del Player

Se agregaron ocho PNG suministrados, sin modificar sus píxeles: jump/fall (64×32,
2 frames a 6 FPS), shoot horizontal/up/diagonal (64×32, 2 frames a 12 FPS), y
runShoot horizontal/up/diagonal (192×32, 6 frames a 11 FPS). Todos usan celdas
32×32, bottom-center, offsets 0/0, includesWeapon y flipX. El manifest conserva
los nombres de archivo diagonalUp y los mapea al sufijo visual `_diagonal`.

Los controles siguen siendo los mismos: W+dirección produce diagonal; W quieto
apunta verticalmente. La variante runShoot_up queda registrada para el estado visual,
sin introducir un control nuevo.

También se integraron jumpShoot horizontal/up/diagonal y crouchShoot horizontal
(64×32, dos frames a 12 FPS), y death (192×32, seis frames a 10 FPS, sin loop).
La muerte visual dura 0,6 segundos y no depende del último apuntado. El respawn
reinicia el visual; la entidad lógica deja de colisionar inmediatamente, como antes.
Todos los PNG adicionales se copian byte por byte, con alpha binario y celdas
32×32; no se cambia escala, offsets, física ni hitboxes. Los clips ausentes o las
texturas que no carguen conservan el fallback del pipeline. Hay 238 tests.

Las poses aim up/diagonal se registran como player.idle_up/player.idle_diagonal: un frame 32×32 para apuntar quieto sin disparar, manteniendo anchor, escala y flipX. Al disparar se utilizan los clips shoot existentes.

### Fase 14: combat VFX

Player y los cuatro enemigos ya tienen sus PNG integrados. El pool existente de 24 VFX ahora tiene fallbacks, flashes por disparo, sparks, explosiones y feedback de drops/pickups/hit/death. Se mantienen 192 partículas pooled; F1 cuenta VFX y F2 muestra bounds/orígenes. Los impactos normales no generan shake. Gameplay, AI, colisiones y respawn permanecen independientes de los efectos.

Configuración y muzzles: src/config/vfx.ts. Los 11 PNG de VFX están activos en public/assets/sprites/fx/. Especificaciones: [contrato de combat VFX](art-reference/combat-vfx.md). No se generaron imágenes nuevas.


### Fase 15: kit modular de environment

Tramo visual preparado: x=0..1024 (cuatro pantallas). Métrica 16x16 para ground y 16x8 visual para metal platforms; collider independiente. EnvironmentView reutiliza TiledVisual/SpriteVisual; top variants deterministas, props sin colisión, checkpoint visual y parallax .15/.40/.75. NEAR corregido para renderizar detrás del gameplay. El resto del nivel conserva el estilo anterior.

Ground y plataformas ya usan 12 PNG dentro del slice; faltan los otros 18 PNG de walls/props/animated/background, con fallback conservado. Contrato exacto de 30 PNG, capas, anchors y activación: [environment-spec.md](art-reference/environment-spec.md). No se generaron imágenes ni se implementó el editor.

Detalles de la primera entrega de tiles: [environment-tiles-integration.md](art-reference/environment-tiles-integration.md).
