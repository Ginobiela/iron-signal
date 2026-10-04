# FlyingEnemy: sprites integrados

Los cinco PNG originales de `public/assets/sprites/enemies/flying/` se conservan
sin modificaciones. RGBA con alpha binario, sin blur ni reescalado.

| ID | PNG | Tamaño | Frames | FPS | Anchor |
| --- | --- | --- | --- | --- | --- |
| flying.fly | flying_fly.png | 128×24 | 4 | 10 | center |
| flying.hit | flying_hit.png | 32×24 | 1 | 12 | center |
| flying.death | flying_death.png | 192×24 | 6 | 12 | center |
| flying.carrier.pod | flying_carrier_pod.png | 12×10 | 1 | 1 | bottom-center |
| flying.carrier.M/S/L | flying_carrier_labels.png | 9×5 | 3 celdas, una por letra | 1 | bottom-center |

Drone: canvas visual 32×24, escala 1, offsets 0/0. Silueta opaca de unas
20×10–12 unidades, coherente con el collider existente 20×14. El origen físico
sigue siendo la esquina inferior izquierda; la vista usa su centro (x+10,y+7).
Fly/hit usan loop; death dura 0,5 segundos, sin loop. No mantiene collider activo.

FlyingCargoVisual compone pod y etiqueta como hijos independientes. La cápsula
se coloca en (0,-13) respecto al centro del drone, sin cambiar su trayectoria.
Las celdas de letras son 3×5, en orden M/S/L; comparten una textura. Offset de
etiqueta (0,5;3) dentro del pod para alinear sus píxeles con el canvas de ancho par.
Las letras no se reflejan. Si falta pod o etiqueta, reaparece el PowerupIcon actual.
El cargo se oculta inmediatamente al morir; el drop conserva su física y su visual
actual, sin usar el atlas del portador como collider ni como lógica de arma.

Hit conserva el tint existente. Mallas y texturas se crean/cargan una vez por
instancia/recurso, nunca en cada frame. Runner y Turret aún esperan assets.
