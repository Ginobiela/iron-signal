# Soldier: sprites integrados

Los PNG originales se conservan sin modificaciones en
`public/assets/sprites/enemies/soldier/`. El master queda como referencia y ya no
se carga en el juego; cada animación usa su spritesheet dedicada.

| ID | PNG | Dimensiones | Frames | FPS | Loop |
| --- | --- | --- | --- | --- | --- |
| soldier.idle | soldier_idle.png | 128×32 | 4 | 6 | sí |
| soldier.run | soldier_run.png | 192×32 | 6 | 10 | sí |
| soldier.shoot | soldier_shoot.png | 64×32 | 2 | 12 | sí |
| soldier.death | soldier_death.png | 192×32 | 6 | 10 | no |

Celdas de 32×32, RGBA con alpha binario 0/255, pies sobre la baseline 32.
Visual 32×32, anchor bottom-center, offsets 0/0, escala 1, dirección base RIGHT
con flipX para LEFT. Collider 12×24 intacto. La silueta de pie ronda 21 px de alto,
coherente con el Player. Idle contiene variación vertical de 1 px en cabeza/torso,
con los pies estables; se conserva el movimiento dibujado sin modificar el PNG.

El rifle está incluido: includesWeapon evita duplicar el cañón. Shoot representa
apuntado horizontal; no hay variantes arriba/diagonal en estas hojas. Las
trayectorias reales siguen dependiendo de la AI existente.

EnemyView refleja el reset del attackTimer para shoot; la animación no dispara
ni bloquea la AI. Hit flash usa tint sobre el mismo material. Death dura 0,6 s:
el enemigo lógico queda inactivo inmediatamente y su visual desaparece al
terminar. Los FX actuales acompañan la muerte. Runner, Turret y FlyingEnemy
siguen en fallback hasta disponer de sus PNG.
