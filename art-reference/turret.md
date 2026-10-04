# Turret: sprites integrados

Tres PNG RGBA con alpha binario 0/255, conservados sin modificar en
`public/assets/sprites/enemies/turret/`. Celdas uniformes de 24×24.

| Clip | PNG | Dimensiones | Frames | FPS | Loop |
| --- | --- | --- | --- | --- | --- |
| turret.idle | turret_idle.png | 48×24 | 2 | 6 | sí |
| turret.shoot | turret_shoot.png | 72×24 | 3 | 10 | sí |
| turret.death | turret_death.png | 144×24 | 6 | 10 | no |

Visual 24×24, bottom-center, offsets 0/0, escala 1. Pies en la baseline 24;
silueta opaca aproximada 19×16. Collider 20×20 y posición física intactos.
Sprites base RIGHT; LEFT utiliza flipX, sin invertir el collider ni aimDirection.

El cañón está incluido en el PNG: includesWeapon evita duplicarlo. La hoja
representa cañón horizontal; no contiene poses de apuntado vertical/diagonal.
La orientación izquierda/derecha sigue enemy.direction. Las trayectorias reales
siguen exactamente la AI existente; no se rota la base completa para simular
un ángulo que el asset no dibuja.

EnemyView conserva el resolver central: aviso/reset del attackTimer refleja
shoot, idle en reposo y death al morir. El clip no genera proyectiles ni bloquea
AI. Death dura 0,6 segundos; salud/contactos/ataques ya están desactivados.
Tint de impacto, debug F1/F2, fallback y NearestFilter existentes se conservan.
