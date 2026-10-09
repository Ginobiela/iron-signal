import type { SpriteAsset } from '../config/assets';

export function assetArtScale(asset: SpriteAsset): number {
  return asset.artScale ?? asset.sheet.frameWidth / asset.visual.width;
}

/** Registration helper only: changes source metadata, not pixels, world bounds or playback. */
export function withArtScale(asset: SpriteAsset, artScale: 1 | 2): SpriteAsset {
  const factor = artScale / assetArtScale(asset);
  const sheet = asset.sheet;
  return { ...asset, artScale, sheet: { ...sheet,
    frameWidth: sheet.frameWidth * factor, frameHeight: sheet.frameHeight * factor,
    margin: sheet.margin === undefined ? undefined : sheet.margin * factor,
    spacing: sheet.spacing === undefined ? undefined : sheet.spacing * factor,
    atlas: sheet.atlas?.map(frame => ({ x: frame.x * factor, y: frame.y * factor,
      width: frame.width * factor, height: frame.height * factor })),
  } };
}

export function assetAnchors(asset: SpriteAsset): { source: { x: number; y: number }; world: { x: number; y: number } } {
  const bottom = asset.visual.anchor === 'bottom-center';
  return {
    source: { x: asset.sheet.frameWidth / 2, y: bottom ? asset.sheet.frameHeight : asset.sheet.frameHeight / 2 },
    world: { x: asset.visual.offsetX, y: asset.visual.offsetY },
  };
}
