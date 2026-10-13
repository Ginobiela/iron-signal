import { expect, it } from 'vitest';
import { EnemySpawner } from '../src/level/EnemySpawner';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { GameStateManager } from '../src/core/GameStateManager';
import { parseLevel } from '../src/level/LevelDocument';
import level1 from '../public/levels/level-01.json';
import level2 from '../public/levels/level-02.json';

it('rearms checkpoint enemies, including past triggers with enemies ahead, without duplicates or earlier waves', () => {
  const enemies = new EnemyManager();
  const spawner = new EnemySpawner([
    {x:0,enemies:[{kind:'runner',x:150,y:44}]},
    {x:100,enemies:[{kind:'soldier',x:300,y:44},{kind:'turret',x:500,y:44,firingMode:'horizontal'}]},
    {x:900,enemies:[{kind:'flying',x:1100,y:100,weaponDrop:'L'}]},
  ], p=>{enemies.spawn(p);});
  spawner.update(600); expect(enemies.items).toHaveLength(3);
  const dead = enemies.items[2]!; dead.takeDamage(dead.health); expect(dead.alive).toBe(false);
  enemies.clear(); spawner.reset(450); expect(spawner.pendingEnemies).toBe(2);
  spawner.update(450); expect(enemies.items).toHaveLength(1);
  const revived = enemies.items[0]!;
  expect(revived).not.toBe(dead); expect(revived.kind).toBe('turret');
  expect(revived.position).toEqual({x:500,y:44}); expect(revived.health).toBe(revived.maxHealth);
  expect(revived.active).toBe(true); expect(spawner.pendingEnemies).toBe(1);
  spawner.update(800); expect(enemies.items).toHaveLength(1);
  spawner.update(900); expect(enemies.items).toHaveLength(2);
  expect(enemies.items[1]!.weaponDrop).toBe('L');
  spawner.update(1000); expect(enemies.items).toHaveLength(2); expect(spawner.pendingEnemies).toBe(0);
  enemies.clear(); spawner.reset(); spawner.update(1000); expect(enemies.items).toHaveLength(4);
});

it('links Level 1 to Level 2 through validated data and links Level 2 to Level 3', () => {
  expect(parseLevel(level1).nextLevel).toBe('levels/level-02.json');
  expect(parseLevel(level2).nextLevel).toBe('levels/level-03.json');
  for(const path of ['https://example.com/level.json','../level.json','levels/../../level.json','']) {
    expect(()=>parseLevel({...level1,nextLevel:path})).toThrow(/nextLevel/);
  }
});

it('starts the next stage with remaining lives while an ordinary new run still resets them', () => {
  const previous = new GameStateManager(); previous.ready(); previous.start(); previous.playerDied(); previous.update(1);
  previous.complete();
  const next = new GameStateManager(); next.ready();
  expect(next.start(previous.lives)).toBe(true); expect(next.lives).toBe(previous.initialLives-1);
  expect(next.state).toBe('PLAYING'); next.complete(); next.start(); expect(next.lives).toBe(next.initialLives);
});
