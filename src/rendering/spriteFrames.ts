import type { SpriteSheet } from '../config/assets';
import type { VisualConfig } from '../config/graphics';

export interface UVRect { left: number; right: number; bottom: number; top: number }

/** Source rectangles use top-left PNG coordinates; Three UVs use bottom-left. */
export function writeFrameUV(sheet: SpriteSheet, index: number, imageWidth: number, imageHeight: number,
  target: UVRect): void {
  const margin = sheet.margin ?? 0;
  const spacing = sheet.spacing ?? 0;
  const columns = sheet.columns ?? Math.max(1, Math.floor((imageWidth - margin * 2 + spacing) / (sheet.frameWidth + spacing)));
  const rows = Math.max(1, Math.floor((imageHeight - margin * 2 + spacing) / (sheet.frameHeight + spacing)));
  const count = Math.max(1, Math.min(sheet.frameCount, sheet.atlas?.length ?? columns * rows));
  const frame = Math.max(0, Math.min(Math.floor(index), count - 1));
  const atlas = sheet.atlas?.[frame];
  const x = atlas?.x ?? margin + (frame % columns) * (sheet.frameWidth + spacing);
  const y = atlas?.y ?? margin + Math.floor(frame / columns) * (sheet.frameHeight + spacing);
  const width = atlas?.width ?? sheet.frameWidth;
  const height = atlas?.height ?? sheet.frameHeight;
  // Half a texel keeps edge samples inside this cell, including padded atlases.
  target.left = (x + 0.5) / imageWidth; target.right = (x + width - 0.5) / imageWidth;
  target.top = 1 - (y + 0.5) / imageHeight; target.bottom = 1 - (y + height - 0.5) / imageHeight;
}

export function spriteCenterY(config: VisualConfig): number {
  return config.offsetY + (config.anchor === 'bottom-center' ? config.height * (config.scaleY ?? 1) / 2 : 0);
}
