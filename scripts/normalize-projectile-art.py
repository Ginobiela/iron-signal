"""Normalize the approved originals without overwriting them (requires Pillow)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'outputs/disparos-lvl1-lvl3-png'
DEST = ROOT / 'public/assets/sprites/projectiles'
FILES = ('player_rifle', 'player_machinegun', 'player_spread', 'player_laser',
         'enemy_soldier', 'enemy_turret', 'boss_lvl1_arena', 'boss_lvl3_gate')

def normalize():
    DEST.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        image = Image.open(SOURCE / f'{name}.png').convert('RGBA')
        # Discard the generated soft halo before fitting the actual silhouette.
        image.putalpha(image.getchannel('A').point(lambda a: 255 if a >= 192 else 0))
        bounds = image.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'{name}: empty silhouette')
        image = image.crop(bounds)
        size = (24, 6) if name == 'player_laser' else (6, 6)
        image.thumbnail(size, Image.Resampling.NEAREST)
        # Compact palette, no dithering; retain binary alpha independently.
        alpha = image.getchannel('A')
        image = image.convert('RGB').quantize(colors=16, dither=Image.Dither.NONE).convert('RGBA')
        image.putalpha(alpha)
        canvas = Image.new('RGBA', size)
        canvas.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
        canvas.save(DEST / f'{name}.png')
        assert set(canvas.getchannel('A').get_flattened_data()) <= {0, 255}
        assert canvas.getchannel('A').getbbox() is not None
        print(f'{name}.png: {size[0]}x{size[1]}, RGBA, binary alpha')

if __name__ == '__main__':
    normalize()
