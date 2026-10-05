# Runner: sprites integrados

Fuente: `public/assets/sprites/enemies/runner/runner_run.png` y
`runner_death.png`, conservadas sin cambios. Ambas son PNG RGBA 144×24 con
seis celdas de 24×24 y alpha binario 0/255. Sin blur ni interpolación.

Run: seis frames a 12 FPS, loop. Death: seis frames a 10 FPS, sin loop;
el visual desaparece a los 0,6 segundos. Se reutiliza el hit flash existente:
no se necesita una animación hit ni un arma visual para este enemigo de contacto.

Canvas visual 24×24, escala 1, bottom-center, offsets 0/0. Todos los frames
terminan en la baseline 24. La cabeza conserva la misma altura en run;
la silueta mide alrededor de 18 px de alto, frente a los 21 px del Soldier.
RIGHT es la dirección original; LEFT utiliza flipX sin mover el origen físico.
El collider sigue en 14×16, velocidad 80, AI y salto automático intactos.

El uniforme ligero oscuro/rojo comparte facción con los enemigos existentes;
el torso inclinado, los brazos libres y la ausencia de rifle diferencian al Runner.
Death conserva el mismo personaje y muestra una caída hacia delante, sin gore.
La última pose todavía representa el colapso en movimiento, no un cuerpo tendido;
se conserva el dibujo suministrado y se retira el visual al terminar.

EnemyView y SpriteVisual existentes resuelven run/death, tint y debug. La muerte
lógica desactiva contactos y AI inmediatamente; la animación no cambia score,
daño, colisiones, spawn ni balance.
