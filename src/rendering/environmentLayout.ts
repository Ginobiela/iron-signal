import { ENVIRONMENT, ENVIRONMENT_ASSETS, ENVIRONMENT_PROPS } from '../config/environment';
import type { EnvironmentId } from '../config/environment';
import type { LevelData } from '../level/Level';

/** Visual-only layout built once, using existing ground heights without changing level data. */
export function environmentLayout(level: LevelData) {
  const props: { id: EnvironmentId; x: number; y: number }[] = [];
  const walls: { id: EnvironmentId; x: number; y: number; width: number; height: number }[] = [];
  for (let base = 0; base < level.width; base += ENVIRONMENT.decorationPeriod) {
    for (const prop of ENVIRONMENT_PROPS) {
      const x = base + prop.x, spec = ENVIRONMENT_ASSETS[prop.id];
      if (x - spec.width / 2 < 0 || x + spec.width / 2 > level.width) continue;
      const ground = level.ground.find(g => x - spec.width / 2 >= g.x && x + spec.width / 2 <= g.x + g.width);
      if (!ground) continue;
      props.push({ id: prop.id, x, y: spec.layer === 'front' ? prop.y : ground.y + ground.height + prop.y - 44 });
    }
    for (const [id, offset, width, height] of [
      ['environment.wall.bunker', 736, 128, 64], ['environment.wall.concrete', 864, 160, 48],
    ] as const) {
      const x = base + offset;
      const ground = level.ground.find(g => x >= g.x && x < g.x + g.width);
      if (ground && x < level.width) walls.push({ id, x, y: ground.y + ground.height,
        width: Math.min(width, ground.x + ground.width - x, level.width - x), height });
    }
  }
  // Continue the same military kit behind the final arena, with no new colliders.
  const x = level.boss.arenaLeft;
  const ground = level.ground.find(g => x >= g.x && x < g.x + g.width);
  if (ground) {
    const y = ground.y + ground.height;
    walls.push({ id: 'environment.wall.bunker', x, y,
      width: Math.min(level.width, ground.x + ground.width) - x, height: 64 });
    for (const [id, dx, dy] of [
      ['environment.prop.crate', 32, 0], ['environment.prop.pipe', 80, 0], ['environment.animated.vent', 112, 48],
    ] as const) {
      if (x + dx + ENVIRONMENT_ASSETS[id].width / 2 <= ground.x + ground.width
        && x + dx + ENVIRONMENT_ASSETS[id].width / 2 <= level.width) props.push({ id, x: x + dx, y: y + dy });
    }
  }
  return { props, walls };
}
