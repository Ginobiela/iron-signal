# Level 1 update and game review — 2026-10-18

## Imported map

Imported `Downloads/level-01.json` into `public/levels/level-01.json`.
Preserved the authored spawn (1296, 144), terrain, platforms, 19 pickups,
seven weapon carriers, ambient 0.4 and campaign transition delay of three seconds.
The only correction relative to the supplied JSON is Runner `enemy-8-3`:
Y 43.6 → 44, aligning its feet with the existing ground surface.

## Confirmed bugs fixed

- That Runner began 0.4 world units inside solid ground. Swept collision expects
  a body to begin outside the solid; the embedded spawn could fall through it.
  Corrected the placement, without changing colliders or collision behavior.
- Duplicating a rectangular enemy trigger reused child enemy IDs and left their
  positions behind. This produced an invalid document that could not export.
  Duplicates now receive new IDs and follow the trigger's X/Y displacement.
  Legacy horizontal triggers retain their existing horizontal displacement.

## Verification

- `npm test`: 419 tests passed across 36 files; no skipped assertions.
- `npm run typecheck`, `npm run build`, `npm run build:devtools`: passed.
- Browser scripts passed: menu, fullscreen, Xbox controls, mobile controls,
  eight-direction aiming, aim lock, campaign/respawn, Level 1, Level 2, Level 3,
  Gameplay Tuner, lighting editor, Level Editor and placeable bosses.
- The edited Level 1 completed an automated runtime traversal with real physics:
  51 jumps, 13 kills, one collected pickup, checkpoint 9344, boss defeated,
  three-second victory hold and transition to Level 2. Damage protection was
  enabled to isolate traversal; movement, weapons and terrain were unchanged.
- Baseline map-dependent migration/physics tests retain their original assertions
  against a frozen pre-edit fixture. Separate tests cover the actual new map's
  serialization, spawn safety, enemy placement and route across the large pit.
- Editor duplication regression checks unique IDs, relative positions, valid
  export/import and exact undo/redo.
- Release build checked in a browser: no Tools button, tuning loading or F3 panel.
- Browser runs reported no runtime errors. The Level 1 boss screenshot was
  inspected; no artwork was changed.

## Remaining observations and limits

- The authored trigger `trigger-f6801b0b-96bc-4588-86af-ef61f2c6df0a` has no enemies.
  Validation reports a warning, not an error; it was preserved.
- Vite reports the existing chunk-size advisory for bundles above 500 kB.
  This is not a failed build.
- The browser traversal checks functionality, not the difficulty of a human run.
  It is not an exhaustive guarantee that every possible interaction is bug-free.
- Render snapshot at the Level 1 boss: 46 draw calls, 53 textures, 863 geometries.
  These are point-in-time counters, not an FPS or memory-leak benchmark.
- Untracked asset backup folders and output files were excluded from this change.
