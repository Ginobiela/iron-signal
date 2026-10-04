import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { PICKUP_VISUAL } from '../config/graphics';
import type { PowerupKind } from '../level/PowerupManager';

const glyphs = {
  M: ['10001', '11011', '10101', '10001', '10001'],
  S: ['11111', '10000', '11111', '00001', '11111'],
  L: ['10000', '10000', '10000', '10000', '11111'],
} as const;
const colors = { M: 0x8ab07b, S: 0xd99758, L: 0x99edff } as const;

export class PowerupIcon {
  readonly root = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly dark = new MeshBasicMaterial({ color: 0x172631 });
  private readonly light = new MeshBasicMaterial({ color: 0xe4dbc5 });
  private readonly color = new MeshBasicMaterial();
  private readonly letters: Record<PowerupKind, Group> = { M: new Group(), S: new Group(), L: new Group() };
  private current: PowerupKind | null = null;

  constructor() {
    const rect = (parent: Group, x: number, y: number, w: number, h: number,
      material: MeshBasicMaterial, z: number): void => {
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(x + w / 2, y + h / 2, z);
      mesh.scale.set(w, h, 1); parent.add(mesh);
    };
    rect(this.root, -7, 0, 14, 14, this.color, 0);
    rect(this.root, -6, 1, 12, 12, this.dark, 0.1);
    rect(this.root, -6, 12, 12, 1, this.light, 0.2);
    for (const kind of ['M', 'S', 'L'] as const) {
      const letter = this.letters[kind];
      const glyph = glyphs[kind];
      for (let row = 0; row < glyph.length; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row]?.[col] === '1') rect(letter, -5 + col * 2, 2 + (4 - row) * 2, 2, 2, this.color, 0.2);
        }
      }
      this.root.add(letter);
    }
    this.root.scale.set(PICKUP_VISUAL.width / 14, PICKUP_VISUAL.height / 14, 1);
    this.setKind('M');
  }

  setKind(kind: PowerupKind): void {
    if (kind === this.current) return;
    this.current = kind;
    this.color.color.setHex(colors[kind]);
    for (const name of ['M', 'S', 'L'] as const) this.letters[name].visible = name === kind;
  }

  dispose(): void { this.geometry.dispose(); this.dark.dispose(); this.light.dispose(); this.color.dispose(); }
}
