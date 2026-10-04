import { NearestFilter, SRGBColorSpace, TextureLoader } from 'three';
import type { Texture } from 'three';

export class AssetManager {
  private readonly textures = new Map<string, Promise<Texture>>();
  private readonly sounds = new Map<string, Promise<AudioBuffer>>();

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
    for (const loading of this.textures.values()) void loading.then((texture) => texture.dispose(), () => {});
    this.textures.clear();
    this.sounds.clear();
  }
}
