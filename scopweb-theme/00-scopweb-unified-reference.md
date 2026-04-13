# scopweb Unified Reference

Documento maestro de referencia para aplicar la identidad visual de scopweb en cualquier stack sin salir de esta carpeta.

## Uso recomendado

1. Lee primero este documento.
2. Usa después [01-scopweb-design-system-reference.md](c:/MCPs/SKILLS/scopweb-theme/01-scopweb-design-system-reference.md) como base visual.
3. Elige el documento técnico según el stack:
   - [scopweb-theme.md](c:/MCPs/SKILLS/scopweb-theme/scopweb-theme.md) para Astro/Starlight
   - [02-firefox-extension-reference.md](c:/MCPs/SKILLS/scopweb-theme/02-firefox-extension-reference.md) para Firefox
   - [03-vanilla-js-reference.md](c:/MCPs/SKILLS/scopweb-theme/03-vanilla-js-reference.md) para Vanilla JS
   - [04-wordpress-admin-reference.md](c:/MCPs/SKILLS/scopweb-theme/04-wordpress-admin-reference.md) para WordPress admin

## Base común obligatoria

Todo proyecto scopweb debe heredar:

- Tipografía: DM Sans para texto e interfaz, Space Mono para títulos, etiquetas técnicas y código.
- Color principal: `#7ec832`.
- Variantes clave: `#55a300`, `#d4e8b8`, `#3d7100`, `#1a3500`.
- Tema oscuro y claro.
- Botones, cards, inputs y badges consistentes.
- Logos `scopweb.jpg` y `scopweb3.png`.
- Fondo a cuadros de scopweb.com cuando el contexto lo permita visualmente.

## Criterio práctico

No conviene un único skill enorme con todos los detalles técnicos mezclados. Lo práctico es tener en una sola carpeta:

- una referencia maestra
- una referencia visual común
- una referencia por plataforma

Así la documentación está junta, pero las decisiones siguen ordenadas.

## Orden de mantenimiento

Cuando cambie la marca:

1. Actualiza primero [01-scopweb-design-system-reference.md](c:/MCPs/SKILLS/scopweb-theme/01-scopweb-design-system-reference.md).
2. Revisa después los documentos técnicos por plataforma.
3. Ajusta [scopweb-theme.md](c:/MCPs/SKILLS/scopweb-theme/scopweb-theme.md) si cambia la versión para Starlight.
