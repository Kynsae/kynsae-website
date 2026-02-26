import { Injectable } from '@angular/core';
import { WebGLRenderer, PerspectiveCamera, Scene, Texture, SRGBColorSpace, CanvasTexture } from 'three';
import { ThreeSceneManager } from '../../../../core/services/three-scene-manager';

export interface TextureLoadProgress {
  loaded: number;
  total: number;
}

@Injectable({ providedIn: null })
export class RenderEngine {
  private _renderer: WebGLRenderer | null = null;
  private _camera: PerspectiveCamera | null = null;
  private _scene: Scene | null = null;
  private _sceneManager: ThreeSceneManager | null = null;
  private _initialized = false;

  public get renderer(): WebGLRenderer {
    return this._renderer!;
  }

  public get camera(): PerspectiveCamera {
    return this._camera!;
  }

  public get scene(): Scene {
    return this._scene!;
  }

  public get isInitialized(): boolean {
    return this._initialized;
  }

  private get sceneManager(): ThreeSceneManager {
    return this._sceneManager ??= new ThreeSceneManager();
  }

  public async init(canvas: any): Promise<void> {
    if (this._initialized) return;

    const el = canvas?.nativeElement ?? canvas;
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, rect.width | 0);
    const h = Math.max(1, rect.height | 0);

    // Yield before heavy WebGL context creation
    await new Promise(r => setTimeout(r, 0));

    this._renderer = new WebGLRenderer({ 
      powerPreference: 'high-performance', 
      antialias: false 
    });
    
    await new Promise(r => setTimeout(r, 0));

    this._camera = new PerspectiveCamera();
    this._scene = new Scene();

    this.sceneManager.resizeRenderer(this._renderer, w, h, 1.6);
    el.appendChild(this._renderer.domElement);
    this._initialized = true;
  }
  
  public resize(width: number, height: number): void {
    if (!this._initialized) return;
    this.sceneManager.resizeRenderer(this._renderer!, width, height, 1.6);
    this.sceneManager.resizePerspectiveCamera(this._camera!, width, height);
  }
  
  public destroy(container?: HTMLElement): void {
    if (this._sceneManager) {
      this._sceneManager.destroy();
      if (this._scene) this._sceneManager.disposeScene(this._scene);
      if (this._renderer) this._sceneManager.disposeRenderer(this._renderer, container);
    }
    this._renderer = null;
    this._camera = null;
    this._scene = null;
    this._sceneManager = null;
    this._initialized = false;
  }

  public render(): void {
    if (this._initialized) {
      this._renderer!.render(this._scene!, this._camera!);
    }
  }

  public async loadTexture(path: string, onProgress?: (p: TextureLoadProgress) => void): Promise<Texture> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load: ${path}`);

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (!response.body) {
      return this.createTexture(await response.blob());
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress?.({ loaded, total: total || loaded });
    }

    return this.createTexture(new Blob(chunks as BlobPart[]));
  }

  private async createTexture(blob: Blob): Promise<Texture> {
    const bitmap = await createImageBitmap(blob, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
      imageOrientation: 'flipY'
    });

    const texture = new CanvasTexture(bitmap as any);
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = false;
    texture.needsUpdate = true;
    
    (texture as any)._width = bitmap.width;
    (texture as any)._height = bitmap.height;
    
    return texture;
  }
}
