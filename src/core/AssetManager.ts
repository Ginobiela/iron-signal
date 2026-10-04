import { NearestFilter, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import type { Texture } from 'three';
import { ASSETS } from '../config/assets';
import type { AssetManifest, SpriteAsset } from '../config/assets';

export class AssetManager {
  private readonly textures = new Map<string, Promise<Texture>>();
  private readonly sounds = new Map<string, Promise<AudioBuffer>>();
  private readonly loaded = new Map<string, Texture>();
  private preloadPromise: Promise<void> | null = null;
  private disposed = false;

  constructor(readonly manifest: AssetManifest = ASSETS) {}

  getTexture(id: string): Texture | undefined { return this.loaded.get(id); }
  getSpriteSheet(id: string): SpriteAsset | undefined { return this.manifest[id]; }

  preload(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.preloadPromise ??= Promise.all(Object.entries(this.manifest).map(async ([id, asset]) => {
      if (!asset.url) return;
      try {
        const texture = await this.texture(asset.url);
        if (asset.tileable) texture.wrapS = texture.wrapT = RepeatWrapping;
        if (!this.disposed) this.loaded.set(id, texture);
      } catch (error: unknown) {
        if (import.meta.env.DEV) console.warn(`[assets] ${id}: usando placeholder (${asset.url})`, error);
      }
    })).then(() => {});
    return this.preloadPromise;
  }

  texture(url: string): Promise<Texture> {
    let loading = this.textures.get(url);
    if (!loading) {
      loading = new TextureLoader().loadAsync(url).then((texture) => {
        texture.magFilter = texture.minFilter = NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = SRGBColorSpace;
        return texture;
      }).catch((error: unknown) => { this.textures.delete(url); throw error; });
      this.textures.set(url, loading);
    }
    return loading;
  }

  sound(url: string, context: AudioContext): Promise<AudioBuffer> {
    let loading = this.sounds.get(url);
    if (!loading) {
      loading = fetch(url).then(async (response) => {
        if (!response.ok) throw new Error(`No se pudo cargar ${url}: ${response.status}`);
        return context.decodeAudioData(await response.arrayBuffer());
      }).catch((error: unknown) => { this.sounds.delete(url); throw error; });
      this.sounds.set(url, loading);
    }
    return loading;
  }

  dispose(): void {
    this.disposed = true;
    for (const loading of this.textures.values()) void loading.then((texture) => texture.dispose(), () => {});
    this.textures.clear();
    this.sounds.clear();
    this.loaded.clear();
  }
}
