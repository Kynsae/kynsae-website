import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { ThreeSceneManager } from '../../../../core/services/three-scene-manager';

const CONFIG = {
  camZ: 2,
  grid: { cols: 160, rows: 160 },
  dotSize: 3,
  spacing: 0,
  parallax: { strength: 0.1, smooth: 0.1 },
  canvasSize: 256,
  fadeStart: 0.95,
} as const;

type TextLayer = {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  charData: Float32Array;
  charDataAttr: THREE.BufferAttribute;
  text: string;
};

@Component({
  selector: 'app-ascii-grid',
  templateUrl: './ascii-grid.html',
  styleUrl: './ascii-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsciiGrid {
  readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('rendererContainer');

  public texts = input.required<string[]>();
  public scrollPercentage = input<number>(0);

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  private readonly renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' });
  private readonly mouseTarget = { x: 0, y: 0 };
  private readonly mouseSmoothed = { x: 0, y: 0 };
  private readonly sceneManager = new ThreeSceneManager();
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private aspectRatio = 1;
  private textLayers: TextLayer[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private shaderCache: { vert: string; frag: string } | null = null;
  private sharedPositions: THREE.Float32BufferAttribute | null = null;
  private sharedUvs: THREE.Float32BufferAttribute | null = null;
  private isVisible = true;
  private intersectionObserver: IntersectionObserver | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private lastScrollPct = -1;
  private isDirty = true;

  constructor() {
    afterNextRender(() => this.init());
    this.destroyRef.onDestroy(() => this.destroy());
  }

  private async init(): Promise<void> {
    await this.loadFont();
    this.initRenderer();
    await this.initializeTextLayers();
    this.setupIntersectionObserver();
    this.setupEventListeners();
    this.ngZone.runOutsideAngular(() => this.sceneManager.startAnimation(this.animate));
  }

  private destroy(): void {
    this.intersectionObserver?.disconnect();
    this.removeEventListeners();
    this.sceneManager.destroy();
    this.textLayers.forEach((l) => this.scene.remove(l.points));
    this.textLayers = [];
    this.sharedPositions = null;
    this.sharedUvs = null;
    this.sceneManager.disposeScene(this.scene);
    this.sceneManager.disposeRenderer(this.renderer, this.containerRef()?.nativeElement);
  }

  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry.isIntersecting;
        if (this.isVisible) this.isDirty = true;
      },
      { threshold: 0 }
    );
    this.intersectionObserver.observe(this.containerRef().nativeElement);
  }

  private setupEventListeners(): void {
    this.ngZone.runOutsideAngular(() => {
      this.mouseMoveHandler = (e: MouseEvent) => this.onMouseMove(e);
      document.addEventListener('mousemove', this.mouseMoveHandler, { passive: true });

      this.resizeHandler = () => this.onResize();
      window.addEventListener('resize', this.resizeHandler, { passive: true });
    });
  }

  private removeEventListeners(): void {
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  private async loadFont(): Promise<void> {
    const font = new FontFace('Gothic', 'url(fonts/gothic.ttf)');
    await font.load();
    document.fonts.add(font);
    await document.fonts.ready;
  }

  private async getShaders(): Promise<{ vert: string; frag: string }> {
    if (this.shaderCache) return this.shaderCache;
    const [vert, frag] = await Promise.all([
      fetch('webgl-ressources/shaders/ascii-grid-vertex.glsl').then((r) => r.text()),
      fetch('webgl-ressources/shaders/ascii-grid-fragment.glsl').then((r) => r.text()),
    ]);
    this.shaderCache = { vert, frag };
    return this.shaderCache;
  }

  private async initializeTextLayers(): Promise<void> {
    this.disposeLayers();
    const shaders = await this.getShaders();
    const entries = this.texts();
    await Promise.all(entries.map((text: string) => this.createTextLayer(text, shaders)));

    if (this.textLayers.length) {
      this.camera.position.set(0, 0, CONFIG.camZ);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateMatrixWorld();
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private disposeLayers(): void {
    this.textLayers.forEach((l) => {
      this.scene.remove(l.points);
      l.points.geometry.dispose();
      l.material.dispose();
    });
    this.textLayers = [];
    this.sharedPositions = null;
    this.sharedUvs = null;
  }

  private visibleRect(): { left: number; right: number; top: number; bottom: number; h: number } {
    const fov = (this.camera.fov * Math.PI) / 180;
    const h = 2 * Math.tan(fov / 2) * CONFIG.camZ;
    const w = h * this.aspectRatio;
    return { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2, h };
  }

  private getSharedGridAttributes(): { positions: THREE.Float32BufferAttribute; uvs: THREE.Float32BufferAttribute } {
    if (this.sharedPositions && this.sharedUvs) {
      return { positions: this.sharedPositions, uvs: this.sharedUvs };
    }
    const { cols, rows } = CONFIG.grid;
    const n = cols * rows;
    const posArr = new Float32Array(n * 3);
    const uvArr = new Float32Array(n * 2);
    const { left, right, top, h } = this.visibleRect();
    const w = right - left;
    const r = rows - 1;
    const c = cols - 1;
    for (let y = 0, i = 0, j = 0; y < rows; y++) {
      const v = y / r;
      const py = top - h * v;
      for (let x = 0; x < cols; x++, i += 3, j += 2) {
        const u = x / c;
        posArr[i] = left + w * u;
        posArr[i + 1] = py;
        posArr[i + 2] = 0;
        uvArr[j] = u;
        uvArr[j + 1] = v;
      }
    }
    this.sharedPositions = new THREE.Float32BufferAttribute(posArr, 3);
    this.sharedUvs = new THREE.Float32BufferAttribute(uvArr, 2);
    return { positions: this.sharedPositions, uvs: this.sharedUvs };
  }

  private getCanvas(): CanvasRenderingContext2D {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.canvas.height = CONFIG.canvasSize;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    }
    return this.ctx!;
  }

  private async createCharTextureData(text: string, out: Float32Array): Promise<void> {
    const ctx = this.getCanvas();
    const s = CONFIG.canvasSize;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 2;
    ctx.shadowColor = '#FFF';
    let fs = 30;
    ctx.font = `bold ${fs}px 'Gothic', sans-serif`;
    const m = ctx.measureText(text);
    if (m.width > s * 0.9) {
      fs = (fs * s * 0.9) / m.width;
      ctx.font = `bold ${fs}px 'Gothic', sans-serif`;
    }
    ctx.fillText(text, s / 2, s / 2);

    const id = ctx.getImageData(0, 0, s, s).data;
    const { cols, rows } = CONFIG.grid;
    const ar = this.aspectRatio || 1;
    const af = ar >= 1 ? 1 / ar : ar;
    const sm1 = s - 1;
    const rm1 = rows - 1;
    const cm1 = cols - 1;
    const inv255 = 1 / 255;
    const gr = 0.299 * inv255;
    const gg = 0.587 * inv255;
    const gb = 0.114 * inv255;

    for (let y = 0; y < rows; y++) {
      const v = y / rm1;
      const tv = ar >= 1 ? (v - 0.5) * af + 0.5 : v;
      for (let x = 0; x < cols; x++) {
        const u = x / cm1;
        const tu = ar >= 1 ? u : (u - 0.5) * ar + 0.5;
        const tx = Math.min(sm1, Math.max(0, Math.floor(tu * sm1)));
        const ty = Math.min(sm1, Math.max(0, Math.floor(tv * sm1)));
        const i = (ty * s + tx) << 2;
        out[y * cols + x] = id[i] * gr + id[i + 1] * gg + id[i + 2] * gb;
      }
    }
  }

  private async createTextLayer(
    text: string,
    shaders: { vert: string; frag: string }
  ): Promise<void> {
    const { positions, uvs } = this.getSharedGridAttributes();
    const n = CONFIG.grid.cols * CONFIG.grid.rows;
    const charData = new Float32Array(n);
    await this.createCharTextureData(text, charData);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', positions);
    geom.setAttribute('uv', uvs);
    geom.setAttribute('charData', new THREE.Float32BufferAttribute(charData, 1));

    const defaultTex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat);
    defaultTex.needsUpdate = true;
    const { h } = this.visibleRect();

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCharTexture: { value: defaultTex },
        uDotSize: { value: CONFIG.dotSize },
        uSpacing: { value: CONFIG.spacing },
        uDistortionAmount: { value: 0.1 },
        uVerticalOffset: { value: 0 },
        uVerticalOffsetScale: { value: h },
        uFadeout: { value: 1 },
        uMouseParallax: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: shaders.vert,
      fragmentShader: shaders.frag,
      transparent: true,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.textLayers.push({
      points,
      material: mat,
      charData,
      charDataAttr: geom.getAttribute('charData') as THREE.BufferAttribute,
      text,
    });
  }

  private initRenderer(): void {
    const el = this.containerRef().nativeElement;
    const { width, height } = el.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
    this.aspectRatio = width / height;
    this.sceneManager.resizeRenderer(this.renderer, width, height);
    this.renderer.setClearColor(0x000000, 1);
    el.appendChild(this.renderer.domElement);
    this.sceneManager.resizePerspectiveCamera(this.camera, width, height);
  }

  private animate = (): void => {
    if (!this.isVisible) return;

    const layers = this.textLayers;
    if (!layers.length) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const { strength, smooth } = CONFIG.parallax;
    const dx = this.mouseTarget.x - this.mouseSmoothed.x;
    const dy = this.mouseTarget.y - this.mouseSmoothed.y;

    if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
      this.mouseSmoothed.x += dx * smooth;
      this.mouseSmoothed.y += dy * smooth;
      this.isDirty = true;
    }

    const pct = Math.max(0, Math.min(1, this.scrollPercentage()));
    if (pct !== this.lastScrollPct) {
      this.lastScrollPct = pct;
      this.isDirty = true;
    }

    if (!this.isDirty) return;
    this.isDirty = false;

    const px = this.mouseSmoothed.x * strength;
    const py = this.mouseSmoothed.y * strength;

    const targetIdx = pct * (this.texts().length - 1);
    const fadeout = pct >= CONFIG.fadeStart ? 1 - (pct - CONFIG.fadeStart) / (1 - CONFIG.fadeStart) : 1;

    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const d = i - targetIdx;
      const absd = Math.abs(d);

      const depth = Math.max(0.3, 1 - absd * 0.25);
      (l.material.uniforms['uMouseParallax'] as THREE.IUniform<THREE.Vector2>).value.set(px * depth, py * depth);
      l.material.uniforms['uVerticalOffset'].value = -d;
      l.material.uniforms['uFadeout'].value = fadeout;
      l.material.opacity = Math.max(0, Math.min(1, 1 - absd * 0.5));
    }
    this.renderer.render(this.scene, this.camera);
  };

  private onMouseMove(e: MouseEvent): void {
    const el = this.containerRef()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, (1 - (e.clientY - r.top) / r.height - 0.5) * 2));
    this.mouseTarget.x = x;
    this.mouseTarget.y = y;
  }

  private onResize(): void {
    this.sceneManager.handleResize(() => {
      const el = this.containerRef().nativeElement;
      const { width, height } = el.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
      const nextAr = width / height;
      const aspectChanged = Math.abs(this.aspectRatio - nextAr) > 0.01;
      this.aspectRatio = nextAr;
      this.sceneManager.resizePerspectiveCamera(this.camera, width, height);
      this.sceneManager.resizeRenderer(this.renderer, width, height);
      if (aspectChanged && this.textLayers.length) {
        const h = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * CONFIG.camZ;
        this.textLayers.forEach((l) => ((l.material.uniforms['uVerticalOffsetScale'] as THREE.IUniform<number>).value = h));
      }
      this.isDirty = true;
    });
  }
}