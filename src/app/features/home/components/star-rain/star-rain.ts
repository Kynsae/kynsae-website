import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  input,
  effect,
  output,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { ThreeSceneManager } from '../../../../core/services/three-scene-manager';

@Component({
  selector: 'app-star-rain',
  templateUrl: './star-rain.html',
  styleUrl: './star-rain.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarRain implements AfterViewInit, OnDestroy {
  readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('rendererContainer');

  readonly sceneReady = output<boolean>();
  readonly percentage = input<number>(0);

  // Must match #define in star-rain.vert.glsl (PATH_PTS, STARS)
  private readonly STARS = 200;
  private readonly COLOR_HEAD = 0x5f68f2;
  private readonly COLOR_TRAIL = 0x6bb3ff;
  private readonly PATH_PTS = 15;
  private readonly PATH_SEGS = 14;
  private readonly TRAIL_SAMPLES = 5;
  private readonly TRAIL_LEN = 10;
  private readonly LAYERS = 15;
  private readonly VS_PATH = 'webgl-ressources/shaders/star-rain.vert.glsl';
  private readonly FS_PATH = 'webgl-ressources/shaders/star-rain.frag.glsl';

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    alpha: true,
    depth: true,
    stencil: false,
  });
  private readonly sceneManager = new ThreeSceneManager();
  private material!: THREE.ShaderMaterial;

  private isVisible = false;
  private lastPct = -1;
  private frameScheduled = false;
  private isInViewport = true;
  private intersectionObserver: IntersectionObserver | null = null;

  constructor() {
    effect(() => {
      const p = this.percentage();
      const show = p > 0 && p < 1;
      if (show && !this.isVisible) this.show();
      else if (!show && this.isVisible) this.hide();
      if (show) this.scheduleFrame();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const el = this.containerRef().nativeElement;
    this.renderer.setPixelRatio(1.0);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.sortObjects = false;
    el.appendChild(this.renderer.domElement);

    const [vertexShader, fragmentShader] = await Promise.all([
      fetch(this.VS_PATH).then((r) => r.text()),
      fetch(this.FS_PATH).then((r) => r.text()),
    ]);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uPct: { value: 0 },
        uPath: { value: this.buildPathTexture() },
        uTrail: { value: this.TRAIL_LEN },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.LineSegments(this.buildGeometry(), this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    this.setupIntersectionObserver();
    this.renderer.domElement.style.display = 'none';
    this.sceneReady.emit(true);
  }

  private setupIntersectionObserver(): void {
    const el = this.containerRef().nativeElement;
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) this.isInViewport = entry.isIntersecting;
      },
      { root: null, rootMargin: '0px', threshold: 0 }
    );
    this.intersectionObserver.observe(el);
  }

  private scheduleFrame(): void {
    if (!this.isVisible || this.frameScheduled) return;
    this.frameScheduled = true;
    requestAnimationFrame(() => {
      this.frameScheduled = false;
      this.animate();
      if (this.isVisible && this.percentage() !== this.lastPct) this.scheduleFrame();
    });
  }

  private buildPathTexture(): THREE.DataTexture {
    const data = new Float32Array(this.STARS * this.PATH_PTS * 4);
    const dir = new THREE.Vector3();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);

    for (let i = 0; i < this.STARS; i++) {
      const start = this.unproject(
        (Math.random() - 0.5) * 2.2,
        -1 - (0.20 + Math.random() * 0.45),
        40 * (0.70 + Math.random() * 1.1)
      );
      start.addScaledVector(right, (Math.random() - 0.5) * 0.15);

      const center = this.unproject(0, 0, 50);
      dir.subVectors(center, start);
      const end = dir.clone().multiplyScalar(1.2 + Math.random() * 1.6).add(center);

      dir.subVectors(end, start);
      const len = Math.max(1e-4, dir.length());
      dir.multiplyScalar(1 / len);

      const base = i * this.PATH_PTS * 4;
      const amp = len * 0.08 * (0.7 + Math.random() * 0.6);
      let cum = 0, px = start.x, py = start.y, pz = start.z;
      let angle = Math.random() * Math.PI * 2;

      data[base] = px;
      data[base + 1] = py;
      data[base + 2] = pz;
      data[base + 3] = 0;

      for (let k = 1; k <= this.PATH_SEGS; k++) {
        const t = k / this.PATH_SEGS;
        const s = len * t;
        angle += 0.8;
        const r = amp * (1 - t);
        const nx = start.x + dir.x * s + Math.cos(angle) * r;
        const ny = start.y + dir.y * s + Math.sin(angle) * r;
        const nz = start.z + dir.z * s;

        const dx = nx - px, dy = ny - py, dz = nz - pz;
        cum += Math.sqrt(dx * dx + dy * dy + dz * dz);

        const idx = base + k * 4;
        data[idx] = nx;
        data[idx + 1] = ny;
        data[idx + 2] = nz;
        data[idx + 3] = cum;

        px = nx; py = ny; pz = nz;
      }
    }

    const tex = new THREE.DataTexture(data, this.PATH_PTS, this.STARS, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private buildGeometry(): THREE.BufferGeometry {
    const verts = this.STARS * this.LAYERS * this.TRAIL_SAMPLES * 2;
    const stars = new Float32Array(verts);
    const ts = new Float32Array(verts);
    const scales = new Float32Array(verts);
    const opacities = new Float32Array(verts);
    const colors = new Float32Array(verts * 3);

    const headCol = new THREE.Color(this.COLOR_HEAD);
    const col = new THREE.Color(this.COLOR_TRAIL);
    const invL = 1 / (this.LAYERS - 1);
    const invS = 1 / this.TRAIL_SAMPLES;
    let vi = 0;

    for (let l = 0; l < this.LAYERS; l++) {
      const lt = l * invL;
      const scale = 1.0 + (0.5 - 1.0) * lt;
      const opacity = 0.04 + (0.12 - 0.04) * lt;
      col.lerp(headCol, lt);

      for (let s = 0; s < this.STARS; s++) {
        for (let seg = 0; seg < this.TRAIL_SAMPLES; seg++) {
          for (let v = 0; v < 2; v++, vi++) {
            stars[vi] = s;
            ts[vi] = (seg + v) * invS;
            scales[vi] = scale;
            opacities[vi] = opacity;
            colors[vi * 3] = col.r;
            colors[vi * 3 + 1] = col.g;
            colors[vi * 3 + 2] = col.b;
          }
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geom.setAttribute('aStar', new THREE.BufferAttribute(stars, 1));
    geom.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
    geom.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geom.setAttribute('aBaseOp', new THREE.BufferAttribute(opacities, 1));
    geom.setAttribute('aCol', new THREE.BufferAttribute(colors, 3));
    return geom;
  }

  private unproject(ndcX: number, ndcY: number, dist: number): THREE.Vector3 {
    const v = new THREE.Vector3(ndcX, ndcY, 0).unproject(this.camera);
    return v.sub(this.camera.position).normalize().multiplyScalar(dist).add(this.camera.position);
  }

  private animate = (): void => {
    if (!this.material || !this.isInViewport) return;
    const p = this.percentage();
    if (p === this.lastPct) return;
    this.lastPct = p;
    this.material.uniforms['uPct'].value = p;
    this.renderer.render(this.scene, this.camera);
  };

  private show(): void {
    this.renderer.domElement.style.display = '';
    this.isVisible = true;
    this.lastPct = -1;
  }

  private hide(): void {
    this.isVisible = false;
    this.renderer.domElement.style.display = 'none';
  }

  @HostListener('window:resize')
  onResize(): void {
    this.sceneManager.handleResize(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Keep aspect 1 to match buildPathTexture() which uses unproject() with the initial camera.
      // Changing aspect would alter the frustum and break the star convergence look.
      this.renderer.setSize(w, h);
    });
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.sceneManager.destroy();
    if (this.material) {
      this.material.uniforms['uPath']?.value?.dispose();
      this.material.dispose();
    }
    this.sceneManager.disposeScene(this.scene);
    this.sceneManager.disposeRenderer(this.renderer, this.containerRef()?.nativeElement);
  }
}
