# Enemigos reutilizables y posiciones del boss

## Colocar mini bosses

En **Level Editor → ENEMY**, elegir **Place in trigger** y luego:

- `mecha.idle`: mecha terrestre que persigue en ambas direcciones y dispara misiles homing.
- `gateTurret.idle`: torreta independiente del Gate, destructible y con su cadencia original.
- `gateHatch.idle`: compuerta destructible que genera Robot Dogs al terminar su apertura lógica.

Hacer click para colocarlos; X/Y, facing, trigger, duplicado, borrado y Undo/Redo
funcionan como con los enemigos anteriores. No requieren instanciar un boss final,
no bloquean la cámara, no crean barreras ni completan el nivel al morir.
Mecha se mueve con colisión/gravedad normal, conservando el tamaño del mecha original.
El boss final del nivel 2 conserva su recorrido de persecución hacia la izquierda.

Se reutilizan todos los PNG aprobados; los aliases del manifest comparten las
mismas definiciones y texturas. El Animation Viewer descubre también estas variantes.
Vida/misiles del mecha vienen de `mecha` en Gameplay Tuner; torreta/compuerta usan
`gate.turretHealth`. La compuerta usa `gate.hatchCooldown` y `gate.maxActiveDogs`
**por compuerta**. Matarla detiene nuevos spawns, pero los perros existentes siguen
en combate. El reset limpia sus perros; respawn/checkpoints reconstruyen los
mini bosses mediante los triggers existentes. No cambian los valores anteriores
de vida, daño, velocidad o cadencia de los bosses originales.

Los placements se serializan normalmente dentro de `spawnGroups[].enemies`:

```json
{"id":"mini-mecha-1","kind":"mecha","x":800,"y":44,"facing":-1}
```

También son válidos `gateTurret` y `gateHatch`. Sus puntos son esquinas inferiores
izquierdas del collider, igual que los enemigos existentes.

## Posiciones refinadas del boss final

- **BOSS SPAWN**: marcador seleccionable con preview del sprite real. Arrastrarlo
  o editar X/Y mueve el boss sin mover su trigger, arena o barrera de persecución.
  Sirve para elegir el punto de aparición exacto del mecha del nivel 2.
- **BOSS TRIGGER**: conserva el control del encuentro completo; arrastrarlo mueve
  conjuntamente spawn, arena y trigger como antes.
- Gate: seleccionar cada torreta/compuerta y arrastrarla, o usar los campos
  `turrets.1.x offset`, `turrets.1.y offset`, etc. del boss. Los offsets están
  expresados en WORLD respecto al origen de la puerta. El preview, las posiciones
  de disparo y los spawns de perros usan esas mismas posiciones en runtime.
- **RESET COMPONENT POSITIONS** vuelve a los offsets actuales; es undoable.

Configuración opcional, compatible con LevelData v1:

```json
"gateLayout": {
  "turrets": [{"x":-40,"y":2},{"x":32,"y":70}],
  "hatches": [{"x":-124,"y":0},{"x":24,"y":0}]
}
```

Hay dos torretas y dos compuertas en el Gate final. Los offsets deben ser finitos,
estar dentro de ±2048 y situar el componente dentro del mundo. Los niveles viejos
sin `gateLayout` usan los offsets legacy de torretas (-80,12)/(32,60) y las mismas
compuertas. Level 3 guarda explícitamente los ajustes locales (-40,2)/(32,70)
del ejemplo, conservando esas posiciones sin hardcodearlas en el boss.
Los marcadores del editor no agregan IDs ni
objetos de gameplay a los JSON. Import/export y Playtest usan el layout actual.

## Validación

`npm test`, `npm run typecheck`, `npm run build`, `npm run build:devtools`.
Con Vite activo: `node scripts/placeable-bosses-check.cjs` verifica palette, drag,
offsets, Undo/Redo, spawn independiente, import, sprites reales, misiles, perros y
respawn en el runtime. Level 3 solo agrega `gateLayout`; no cambia su geometría.
