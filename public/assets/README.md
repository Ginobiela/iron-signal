# Assets originales de Iron Signal

Contrato de dimensiones, anchors, animaciones y PNG: [sprite-spec](../../art-reference/sprite-spec.md).

Se incluyen Player idle/run/crouch normalizados, jump/fall, shoot/runShoot/jumpShoot
horizontal/up/diagonal, crouchShoot horizontal, death y poses aim up/diagonal.
Las demás carpetas quedan
preparadas. Copiar un PNG no altera
gameplay: activarlo mediante `url` en `src/config/assets.ts`. Las entradas sin url
no solicitan archivos. Si una textura activada falta, se mantiene el placeholder.
Usar rutas `assets/...` relativas para GitHub Pages. No incorporar recursos de Contra.

Environment: rutas bajo environment/, 12 tiles integrados y 18 PNG restantes en fallback. Especificaciones completas: [environment-spec.md](../../art-reference/environment-spec.md). Activar cada PNG con enabled: true en src/config/environment.ts; assets.ts deriva el manifest. El fallback se conserva si falta una textura.
