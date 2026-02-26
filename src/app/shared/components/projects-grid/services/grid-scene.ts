import { inject, Injectable, NgZone } from '@angular/core';
import { Vector2, Vector3, Texture, ShaderMaterial, PlaneGeometry, Mesh } from 'three';
import { BehaviorSubject, Observable } from 'rxjs';
import { RenderEngine } from './render-engine';
import { GridItem } from '../models/grid-item.model';
import { ThreeSceneManager } from '../../../../core/services/three-scene-manager';
import { Project } from '../../../models/project.model';

@Injectable()
export class GridScene {
  public items: GridItem[] = [];
  
  private shaderVS = '';
  private shaderFS = '';
  private smVel = 0;
  private lastY = 0;
  private lastT = 0;
  private lastFrame = 0;
  private hoveredMeshIndex: number | null = null;
  private containerEl: HTMLElement | null = null;
  private cachedGapPx: number | null = null;
  private cachedInlineGrid: HTMLElement | null = null;
  private isDestroyed = false;
  private readonly sceneManager = new ThreeSceneManager();

  private readonly progressSubject = new BehaviorSubject<number>(0);
  public readonly loadProgress$: Observable<number> = this.progressSubject.asObservable();

  // Layout constants
  private readonly NUM_COLS = 2;
  private readonly COL_GAP_PX = 30;
  private readonly TOP_PADDING_PX = 40;
  
  // Animation constants
  private readonly CORNER_R = 0.08;
  private readonly VEL_SENS = 0.02;
  private readonly DECAY = 0.7;
  private readonly MAX_V = 3.5;
  private readonly TARGET_IN = 1.0;
  private readonly TARGET_OUT = 0.7;
  private readonly ZOOM_IN = 1.15;
  private readonly ZOOM_OUT = 1.6;
  private readonly MAX_TILT = 0.38;
  private readonly SCALE_TAU = 160;
  private readonly ROT_TAU = 400;
  private readonly ZOOM_TAU = 160;
  private readonly HOVER_TAU = 400;

  private readonly renderEngine = inject(RenderEngine);
  private readonly ngZone = inject(NgZone);

  // Reusable objects to avoid allocations
  private readonly tempVec3 = new Vector3();
  private readonly corners: readonly Vector3[] = [
    new Vector3(-0.5, -0.5, 0),
    new Vector3(0.5, -0.5, 0),
    new Vector3(0.5, 0.5, 0),
    new Vector3(-0.5, 0.5, 0)
  ];

  public async init(containerElRef: any, projects: readonly Project[]): Promise<void> {
    this.isDestroyed = false;
    
    await this.yield();
    if (this.isDestroyed) return;
    
    await this.renderEngine.init(containerElRef);
    if (this.isDestroyed) return;
    
    this.containerEl = containerElRef?.nativeElement ?? containerElRef;
    this.cachedInlineGrid = document.querySelector('.inline-grid') as HTMLElement;
    
    await this.setupGrid(projects);
    if (this.isDestroyed) return;
    
    this.layout();
    
    // Upload all textures to GPU BEFORE starting animation (no flickering)
    await this.uploadAllTexturesToGPU();
    if (this.isDestroyed) return;
    
    // Warm-up render to compile shaders
    this.renderEngine.render();
    await this.yield();
    if (this.isDestroyed) return;
    
    // Now start animation - everything is ready on GPU
    this.ngZone.runOutsideAngular(() => this.startAnimation());
  }

  private yield(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Uploads all textures to GPU one at a time with yields.
   * This ensures zero flickering when animation starts.
   */
  private async uploadAllTexturesToGPU(): Promise<void> {
    if (!this.renderEngine.isInitialized) return;
    
    const renderer = this.renderEngine.renderer;
    const len = this.items.length;
    
    for (let i = 0; i < len; i++) {
      if (this.isDestroyed) return;
      
      const texture = this.items[i]?.mat?.uniforms?.['uMap']?.value;
      if (texture) {
        renderer.initTexture(texture);
      }
      
      // Update progress: 80% base + 20% for GPU upload
      this.progressSubject.next(80 + Math.round(((i + 1) / len) * 20));
      
      // Yield every texture to maintain 60fps during upload
      await this.yield();
    }
    
    this.progressSubject.next(100);
  }

  public setHoveredIndex(index: number | null): void {
    if (this.hoveredMeshIndex === index) return;
    this.hoveredMeshIndex = index;
    if (index === null) {
      const len = this.items.length;
      for (let i = 0; i < len; i++) {
        this.items[i].hoverUv = null;
      }
    }
  }

  public setHoverUv(index: number, u: number, v: number): void {
    const item = this.items[index];
    if (!item) return;
    (item.hoverUv ??= new Vector2()).set(u, v);
  }

  public onScroll(): void {
    const now = performance.now();
    const y = window.scrollY;
    const dt = now - this.lastT;
    if (dt > 0) {
      const v = Math.max(-this.MAX_V, Math.min(this.MAX_V, (y - this.lastY) / dt));
      this.smVel += v * 0.3;
    }
    this.lastY = y;
    this.lastT = now;
  }

  public onResize(): void {
    if (!this.renderEngine.isInitialized) return;
    this.cachedGapPx = null;
    this.sceneManager.handleResize(() => {
      if (!this.renderEngine.isInitialized) return;
      const rect = this.renderEngine.renderer.domElement.getBoundingClientRect();
      this.renderEngine.resize(Math.max(1, rect.width | 0), Math.max(1, rect.height | 0));
      this.layout();
    });
  }

  private startAnimation(): void {
    this.lastFrame = performance.now();
    this.sceneManager.startAnimation(this.animate);
  }
  
  public destroy(container?: HTMLElement): void {
    this.isDestroyed = true;
    this.sceneManager.destroy();
    this.renderEngine.destroy(container);
    this.cachedInlineGrid = null;
    this.cachedGapPx = null;
    this.items = [];
  }

  private layout(): void {
    if (!this.renderEngine.isInitialized || !this.items.length) return;
    
    const hostEl = this.containerEl ?? this.renderEngine.renderer.domElement;
    const width = Math.max(1, hostEl.getBoundingClientRect().width | 0);
    const colGapPx = this.getColGapPx();
    const numRows = Math.ceil(this.items.length / this.NUM_COLS);
    const colW = Math.max(1, (width - colGapPx) / this.NUM_COLS);
    const tileHpx = colW / (16 / 9);
    const cW = width;
    const cH = Math.ceil(numRows * tileHpx + (numRows - 1) * colGapPx + this.TOP_PADDING_PX);
    
    const renderer = this.renderEngine.renderer;
    const camera = this.renderEngine.camera;
    
    renderer.setSize(cW, cH);
    camera.aspect = cW / cH;
    camera.updateProjectionMatrix();
    camera.position.set(0, 0, 5);
    
    const fov = camera.fov * Math.PI / 180;
    const worldH = 2 * camera.position.z * Math.tan(fov / 2);
    const worldW = worldH * camera.aspect;
    const px2wX = worldW / cW;
    const px2wY = worldH / cH;
    const colWw = colW * px2wX;
    const tileHw = tileHpx * px2wY;
    const colGapW = colGapPx * px2wX;
    const gapW = colGapPx * px2wY;
    const baseX = -worldW / 2 + (Math.max(0, (width - colW * this.NUM_COLS - colGapPx) / 2) + colW / 2) * px2wX;
    
    const items = this.items;
    const len = items.length;
    
    for (let i = 0; i < len; i++) {
      const item = items[i];
      const scale = item.geoScale;
      item.baseSize.set(colWw, tileHw);
      item.mesh.scale.set(colWw * scale, tileHw * scale, 1);
      item.mat.uniforms['uSizeWorld'].value.set(colWw * scale, tileHw * scale);
    }

    let curY = worldH / 2 - this.TOP_PADDING_PX * px2wY;
    for (let r = 0; r < numRows; r++) {
      const yy = curY - tileHw / 2;
      for (let c = 0; c < this.NUM_COLS; c++) {
        const i = r * this.NUM_COLS + c;
        if (i >= len) break;
        const item = items[i];
        const xx = baseX + c * (colWw + colGapW);
        item.baseCenter.set(xx, yy);
        item.anchorDir = c === this.NUM_COLS - 1 ? -1 : 1;
        item.mesh.position.set(xx + item.anchorDir * (colWw * (1 - item.geoScale)) / 2, yy, 0);
        item.mat.uniforms['uLeftWeight'].value = c === this.NUM_COLS - 1 ? 1 : 0;
      }
      curY -= tileHw + gapW;
    }
  }

  private getColGapPx(): number {
    if (this.cachedGapPx !== null) return this.cachedGapPx;
    
    if (this.cachedInlineGrid) {
      const cs = getComputedStyle(this.cachedInlineGrid);
      const gap = parseFloat(cs.columnGap || cs.gap || '0');
      if (gap > 0) {
        this.cachedGapPx = Math.round(gap);
        return this.cachedGapPx;
      }
    }
    
    return this.cachedGapPx = this.COL_GAP_PX;
  }

  private createMaterial(map: Texture): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uTilt: { value: 0 },
        uLeftWeight: { value: 0 },
        uCornerRadius: { value: this.CORNER_R },
        uSizeWorld: { value: new Vector2(1, 1) },
        uUvZoom: { value: 1 },
        uUvTilt: { value: new Vector2(0, 0) },
        uHover: { value: 0 },
        uMapAspect: { value: 1 }
      },
      vertexShader: this.shaderVS,
      fragmentShader: this.shaderFS
    });
  }

  private async setupGrid(projects: readonly Project[]): Promise<void> {
    const len = projects.length;
    if (!len) return;
    
    // Progress: shaders 10%, textures 50%, meshes 20%, GPU upload 20%
    const textureProgress = new Array<number>(len).fill(0);
    let shaderProgress = 0;
    let meshProgress = 0;

    const updateProgress = () => {
      if (this.isDestroyed) return;
      const textureAvg = textureProgress.reduce((a, b) => a + b, 0) / len;
      // Reserve last 20% for GPU upload (handled separately)
      const total = shaderProgress * 0.1 + textureAvg * 0.5 + (meshProgress / len) * 0.2;
      this.progressSubject.next(Math.min(80, Math.round(total * 100)));
    };

    this.progressSubject.next(0);

    // Load shaders and textures concurrently
    const [shaders, textures] = await Promise.all([
      this.loadShaders().then(result => { shaderProgress = 1; updateProgress(); return result; }),
      this.loadTextures(projects, textureProgress, updateProgress)
    ]);
    
    if (this.isDestroyed) return;
    
    [this.shaderVS, this.shaderFS] = shaders;
    
    // Create meshes
    const geom = new PlaneGeometry(1, 1);
    this.items = [];
    
    for (let i = 0; i < len; i++) {
      if (this.isDestroyed) return;
      
      const texture = textures[i];
      if (!texture) continue;
      
      const mat = this.createMaterial(texture);
      const aspect = (texture as any)._width / ((texture as any)._height || 1);
      mat.uniforms['uMapAspect'].value = isFinite(aspect) && aspect > 0 ? aspect : 1;
      
      const mesh = new Mesh(geom, mat);
      this.renderEngine.scene.add(mesh);
      
      this.items.push({
        mesh, mat,
        baseSize: new Vector2(1, 1),
        baseCenter: new Vector2(0, 0),
        geoScale: 0.85,
        anchorDir: 1,
        hoverValue: 0,
        uvZoom: 1.9,
        hoverUv: null,
        uvTilt: new Vector2(0, 0)
      } as GridItem);
      
      meshProgress = i + 1;
      updateProgress();
      await this.yield();
    }

    // Progress now at 80%, GPU upload will take it to 100%
    this.progressSubject.next(80);
  }

  private async loadShaders(): Promise<[string, string]> {
    const [vs, fs] = await Promise.all([
      fetch('webgl-ressources/shaders/grid-viewer-vertex.glsl').then(r => r.text()),
      fetch('webgl-ressources/shaders/grid-viewer-fragment.glsl').then(r => r.text())
    ]);
    return [vs, fs];
  }

  private async loadTextures(
    projects: readonly Project[], 
    progress: number[], 
    onUpdate: () => void
  ): Promise<Texture[]> {
    const textures: Texture[] = [];
    
    for (let i = 0; i < projects.length; i++) {
      if (this.isDestroyed) break;
      
      const texture = await this.renderEngine.loadTexture(projects[i].thumbnail!, p => {
        progress[i] = p.total > 0 ? p.loaded / p.total : 0;
        onUpdate();
      });
      
      progress[i] = 1;
      onUpdate();
      textures.push(texture);
      await this.yield();
    }
    
    return textures;
  }

  private isInViewport(mesh: Mesh, rect: DOMRect, cw: number, ch: number): boolean {
    const camera = this.renderEngine.camera;
    const temp = this.tempVec3;
    const corners = this.corners;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (let i = 0; i < 4; i++) {
      temp.copy(corners[i]);
      mesh.localToWorld(temp);
      temp.project(camera);
      const px = (temp.x * 0.5 + 0.5) * cw + rect.left;
      const py = (1 - (temp.y * 0.5 + 0.5)) * ch + rect.top;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    return maxX >= -2 && minX <= window.innerWidth + 2 && 
           maxY >= -2 && minY <= window.innerHeight + 2;
  }

  private lerp(current: number, target: number, dt: number, tau: number): number {
    return current + (target - current) * (1 - Math.exp(-dt / tau));
  }

  private animate = (): void => {
    const now = performance.now();
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    
    this.smVel *= this.DECAY;
    const tilt = Math.max(-0.9, Math.min(0.9, this.smVel * this.VEL_SENS));
    
    const rect = this.renderEngine.renderer.domElement.getBoundingClientRect();
    const cw = rect.width || 1;
    const ch = rect.height || 1;
    
    const items = this.items;
    const len = items.length;
    const hoveredIdx = this.hoveredMeshIndex;
    
    for (let i = 0; i < len; i++) {
      const item = items[i];
      const u = item.mat.uniforms as any;
      u['uTilt'].value = tilt;

      const inside = this.isInViewport(item.mesh, rect, cw, ch);
      
      item.geoScale = this.lerp(item.geoScale, inside ? this.TARGET_IN : this.TARGET_OUT, dt, this.SCALE_TAU);
      item.uvZoom = this.lerp(item.uvZoom, inside ? this.ZOOM_IN : this.ZOOM_OUT, dt, this.ZOOM_TAU);
      item.hoverValue = this.lerp(item.hoverValue, hoveredIdx === i ? 1 : 0, dt, this.HOVER_TAU);
      
      const bx = item.baseSize.x;
      const by = item.baseSize.y;
      const sx = bx * item.geoScale;
      const sy = by * item.geoScale;
      
      item.mesh.scale.set(sx, sy, 1);
      u['uSizeWorld'].value.set(sx, sy);
      u['uUvZoom'].value = item.uvZoom;
      u['uHover'].value = item.hoverValue;
      
      let tx = 0, ty = 0;
      if (hoveredIdx === i && item.hoverUv) {
        tx = Math.max(-1, Math.min(1, 0.5 - item.hoverUv.x)) * this.MAX_TILT;
        ty = Math.max(-1, Math.min(1, 0.5 - item.hoverUv.y)) * this.MAX_TILT;
      }

      const ntx = this.lerp(item.uvTilt.x, tx, dt, this.ROT_TAU);
      const nty = this.lerp(item.uvTilt.y, ty, dt, this.ROT_TAU);
      item.uvTilt.set(ntx, nty);
      u['uUvTilt'].value.set(ntx, nty);
      item.mesh.position.x = item.baseCenter.x + item.anchorDir * (bx * (1 - item.geoScale)) / 2;
    }
    
    this.renderEngine.render();
  };
}
