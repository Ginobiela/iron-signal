const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(),
  `${require('node:os').homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`] }));
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1550, height: 820 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replaceAll('game.start();', 'window.g=game;game.start();') });
    });
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForFunction(() => window.g?.states.state === 'MENU');
    const report = await page.evaluate(async () => {
      g.loop.stop(); await g.assets.preload();
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { Turret } = await import('/src/entities/enemies/Turret.ts');
      const { GateTurret } = await import('/src/entities/enemies/GateTurret.ts');
      const { EnemyView } = await import('/src/rendering/EnemyView.ts');
      const { enemyMuzzle } = await import('/src/rendering/vfxOrigins.ts');
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0x26323e);
      const camera = new THREE.OrthographicCamera(0, 384, 176, 0, .1, 100); camera.position.z = 10;
      const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setPixelRatio(1); renderer.setSize(768, 352);
      renderer.domElement.id = 'turret-preview';
      renderer.domElement.style.cssText = 'position:fixed;top:24px;left:4px;width:1536px;height:704px;image-rendering:pixelated;z-index:9999';
      document.body.append(renderer.domElement);
      let count = 0;
      for (const [row, Type] of [Turret, GateTurret].entries()) for (let sector = 0; sector < 8; sector++) {
        const angle = sector * Math.PI / 4, enemy = new Type(8 + sector * 48, row === 0 ? 108 : 20);
        enemy.active = true; enemy.attackTimer = 0; enemy.direction = Math.cos(angle) < -.01 ? -1 : 1;
        enemy.aimDirection.x = Math.cos(angle + .08); enemy.aimDirection.y = Math.sin(angle + .08);
        const aim = { ...enemy.aimDirection }, timer = enemy.attackTimer;
        const view = new EnemyView(enemy, g.assets); view.update(0); scene.add(view.root);
        if (!view.turretAim.root.visible || view.sprite.root.visible || view.gun.visible) throw Error('Missing composed turret / duplicate weapon');
        if (view.turretAim.base.root.rotation.z !== 0 || enemy.attackTimer !== timer
          || enemy.aimDirection.x !== aim.x || enemy.aimDirection.y !== aim.y) throw Error('Base or gameplay mutated');
        const source = g.assets.getTexture(`${enemy.visualPrefix}.${enemy.shootAnimation}`);
        if (view.turretAim.head.mesh.material.map !== source || view.turretAim.base.mesh.material.map !== source)
          throw Error('Parts must share their real original PNG');
        const muzzle = { x: 0, y: 0, angle: 0 }; enemyMuzzle(enemy, g.assets, muzzle);
        const marker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffd066 }));
        marker.position.set(muzzle.x, muzzle.y, 5); scene.add(marker);
        count++;
      }
      renderer.render(scene, camera); window.turretPreview = { scene, camera, renderer };
      return { count, calls: renderer.info.render.calls, textures: renderer.info.memory.textures };
    });
    assert.equal(report.count, 16);
    await page.locator('#turret-preview').screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'iron-signal-turret-eight-directions.png') });
    assert.deepEqual(errors, []);
    console.log('Turret eight-direction browser check passed: real idle/shoot atlas parts, fixed bases, shared PNG textures, no gameplay mutations.', report);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
