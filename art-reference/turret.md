# Turret: sprites integrados

Tres PNG RGBA con alpha binario 0/255, conservados sin modificar en
`public/assets/sprites/enemies/turret/`. Celdas actuales 48×48 source (2×),
conservando 24×24 world.

| Clip | PNG | Dimensiones | Frames | FPS | Loop |
| --- | --- | --- | --- | --- | --- |
| turret.idle | turret_idle.png | 96×48 | 2 | 6 | sí |
| turret.shoot | turret_shoot.png | 144×48 | 3 | 10 | sí |
| turret.death | turret_death.png | 288×48 | 6 | 10 | no |

Visual 24×24, bottom-center, offsets 0/0, escala 1. Pies en la baseline 24;
silueta opaca aproximada 19×16. Collider 20×20 y posición física intactos.
Sprites base RIGHT; LEFT utiliza flipX, sin invertir el collider ni aimDirection.

El cañón está incluido en el PNG: includesWeapon evita duplicarlo.
`TurretAimVisual` separa soporte y cabezal con regiones de atlas de la misma
textura, sin crear PNG nuevos ni clonar texturas. El soporte permanece horizontal;
el cabezal se orienta al sector de 45° más cercano al aimDirection real (8 sectores).
Idle y shoot mantienen su animación original. Death usa el sprite completo.
Los pivotes y cortes source están centralizados en `src/config/turretArt.ts`.
Se aplica también a `bossGateTurret` (incluidas las torretas del Gate y las
colocadas con el editor). Los recortes internos no aparecen como clips del viewer.

El muzzle flash usa el pivote y la orientación del cabezal. La dirección continua,
el origen de las balas, daño, cadencia, AI y colliders permanecen intactos.
Si faltan las regiones/texturas, se mantiene el fallback existente.

EnemyView conserva el resolver central: aviso/reset del attackTimer refleja
shoot, idle en reposo y death al morir. El clip no genera proyectiles ni bloquea
AI. Death dura 0,6 segundos; salud/contactos/ataques ya están desactivados.
Tint de impacto, debug F1/F2, fallback y NearestFilter existentes se conservan.
