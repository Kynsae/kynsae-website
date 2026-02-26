import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';

import * as THREE from 'three';

@Component({
  selector: 'app-circular-grid',
  templateUrl: './circular-grid.html',
  styleUrl: './circular-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircularGrid implements AfterViewInit, OnDestroy {
  readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('rendererContainer');

  public readonly rotationProgress = input<number>(0);
  public readonly fadeIn = input<boolean>(false);

  private readonly zone = inject(NgZone);

  // Config
  private readonly ORTHO_SIZE = 6;
  private readonly MAX_PIXEL_RATIO = 2;
  private readonly MIN_RING_RADIUS = 4.7;
  private readonly MIN_RING_RADIUS_MOBILE = 6.2;
  private readonly RING_SPACING = 0.7;
  private readonly RING_SPACING_MOBILE = 1.0;
  private readonly MOBILE_BREAKPOINT = 768;
  private readonly RING_OVERSCAN = 1.1;
  private readonly PARTICLES_PER_RING = 110;
  private readonly SPEED_EXP_MIN = 0.65;
  private readonly SPEED_EXP_MAX = 1.75;
  private readonly OPACITY_MIN = 0.;
  private readonly OPACITY_MAX = 0.8;
  private readonly POINT_SIZE = 4.0;
  private readonly IDLE_ROTATION_SPEED = 0.001;
  private readonly FADE_IN_DURATION = 1.8;
  private readonly FADE_IN_EASE_IN = 1.1;
  private readonly FADE_IN_EASE_OUT = 4.;
  private readonly FADE_IN_DELAY = 0.7;
  private readonly VS_PATH = 'webgl-ressources/shaders/circular-grid.vert.glsl';
  private readonly FS_PATH = 'webgl-ressources/shaders/circular-grid.frag.glsl';
  private readonly TAU = Math.PI * 2;

  // Three.js core
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: true });

  // Pre-computed sin/cos table for particle placement
  private readonly unitTable: Float32Array;

  // State
  private material: THREE.ShaderMaterial | null = null;
  private uniforms: Record<string, THREE.IUniform> | null = null;
  private points: THREE.Points | null = null;
  private geo: THREE.BufferGeometry | null = null;
  private ringCount = 0;
  private prevProgress = -1;
  private prevRotInput = 0;
  private accumRotation = 0;
  private prevSpacing = -1;
  private prevMinRadius = -1;
  private prevW = 0;
  private prevH = 0;
  private effectiveOrtho = this.ORTHO_SIZE;
  private resizeRaf = 0;
  private animRaf = 0;
  private t0 = 0;
  private ready = false;
  private fadeInStart = -1;
  private fadeInValue = 0;
  private allHidden = false;

  constructor() {
    const ppr = this.PARTICLES_PER_RING;
    this.unitTable = new Float32Array(ppr * 2);
    for (let i = 0; i < ppr; i++) {
      const a = (i / ppr) * this.TAU;
      this.unitTable[i * 2] = Math.cos(a);
      this.unitTable[i * 2 + 1] = Math.sin(a);
    }

    effect(() => {
      const v = this.rotationProgress();
      const p = THREE.MathUtils.clamp(Number.isFinite(v) ? v : 0, 0, 1);
      this.zone.runOutsideAngular(() => {
        if (this.ready) this.setProgress(p);
      });
    });

    effect(() => {
      if (this.fadeIn()) {
        this.zone.runOutsideAngular(() => {
          this.fadeInStart = performance.now() * 0.001;
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(async () => {
      const el = this.containerRef().nativeElement;
      const dpr = Math.min(window.devicePixelRatio, this.MAX_PIXEL_RATIO);

      this.camera.position.set(0, 0, 10);
      this.camera.lookAt(0, 0, 0);
      this.renderer.setPixelRatio(dpr);
      this.renderer.setClearColor(0x000000, 0);
      Object.assign(this.renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
      el.appendChild(this.renderer.domElement);

      const [vs, fs] = await Promise.all([
        fetch(this.VS_PATH).then((r) => r.text()),
        fetch(this.FS_PATH).then((r) => r.text()),
      ]);

      this.material = this.createMaterial(dpr, vs, fs);
      this.uniforms = this.material.uniforms;
      this.resize();
      this.syncRings();
      this.setProgress(0);
      window.addEventListener('resize', this.onResize);
      this.ready = true;
      this.t0 = performance.now() * 0.001;
      this.startLoop();
    });
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      cancelAnimationFrame(this.animRaf);
      window.removeEventListener('resize', this.onResize);
      this.dispose();
      this.renderer.dispose();
      this.renderer.domElement.remove();
      this.ready = false;
    });
  }

  private readonly onResize = (): void => {
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      if (this.resize()) this.syncRings();
    });
  };

  private startLoop(): void {
    const u = this.uniforms!;
    const idleUniform = u['uIdleRotation'];
    const fadeInUniform = u['uFadeIn'];
    const speed = this.IDLE_ROTATION_SPEED;
    const dur = this.FADE_IN_DURATION;
    const eIn = this.FADE_IN_EASE_IN;
    const eOut = this.FADE_IN_EASE_OUT;
    const delay = this.FADE_IN_DELAY;
    const { scene, camera, renderer } = this;
    const t0 = this.t0;

    const tick = (): void => {
      const now = performance.now() * 0.001;
      idleUniform.value = -(now - t0) * speed;

      if (this.fadeInStart >= 0 && this.fadeInValue < 1) {
        const elapsed = now - this.fadeInStart - delay;
        if (elapsed > 0) {
          const t = Math.min(1, elapsed / dur);
          this.fadeInValue = t;
          fadeInUniform.value = 1 - Math.pow(1 - Math.pow(t, eIn), eOut);
        }
      }

      if (!this.allHidden) renderer.render(scene, camera);
      this.animRaf = requestAnimationFrame(tick);
    };
    this.animRaf = requestAnimationFrame(tick);
  }

  private resize(): boolean {
    const { clientWidth: w, clientHeight: h } = this.containerRef().nativeElement;
    const width = Math.max(1, w), height = Math.max(1, h);
    if (width === this.prevW && height === this.prevH) return false;
    this.prevW = width;
    this.prevH = height;

    const a = width / height;
    // On portrait viewports, scale up ortho size so rings fit within the narrower width
    const s = a >= 1 ? this.ORTHO_SIZE : this.ORTHO_SIZE / a;
    this.effectiveOrtho = s;

    this.camera.left = -s * a;
    this.camera.right = s * a;
    this.camera.top = s;
    this.camera.bottom = -s;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    return true;
  }

  private syncRings(): void {
    const aspect = this.prevW > 0 && this.prevH > 0 ? this.prevW / this.prevH : 1;
    const s = this.effectiveOrtho;
    const maxR = Math.hypot(s * aspect, s) * this.RING_OVERSCAN;
    const baseMinR = this.prevW <= this.MOBILE_BREAKPOINT ? this.MIN_RING_RADIUS_MOBILE : this.MIN_RING_RADIUS;
    const minR = Math.min(baseMinR, maxR);
    const span = Math.max(0, maxR - minR);
    const ringSpacing = this.prevW <= this.MOBILE_BREAKPOINT ? this.RING_SPACING_MOBILE : this.RING_SPACING;
    const count = Math.max(1, Math.round(span / ringSpacing) + 1);
    const spacing = count > 1 ? span / (count - 1) : 0;

    if (this.geo && count === this.ringCount) {
      this.updateLayout(count, minR, spacing);
    } else {
      this.buildGeometry(count, minR, spacing);
      this.ringCount = count;
      this.prevProgress = -1;
    }
  }

  private setProgress(p: number): void {
    const u = this.uniforms;
    if (!u) return;
    const d = p - this.prevRotInput;
    this.accumRotation += d > 0.5 ? d - 1 : d < -0.5 ? d + 1 : d;
    this.prevRotInput = p;
    u['uRotationProgress'].value = -this.accumRotation;

    if (p === this.prevProgress) return;
    this.prevProgress = p;
    u['uProgress'].value = p;
    this.allHidden = p >= 1;
  }

  private seededRand(seed: number, min: number, max: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
    return min + (max - min) * (x - Math.floor(x));
  }

  private buildGeometry(count: number, minR: number, spacing: number): void {
    if (!this.material) return;
    if (this.points) this.scene.remove(this.points);
    this.geo?.dispose();

    const ppr = this.PARTICLES_PER_RING;
    const n = count * ppr;
    const unit = new Float32Array(n * 2);
    const rad = new Float32Array(n);
    const alp = new Float32Array(n);
    const spd = new Float32Array(n);
    const tbl = this.unitTable;

    let c = 0;
    for (let ri = 0; ri < count; ri++) {
      const r = minR + ri * spacing;
      const s = this.seededRand(ri + 1, this.SPEED_EXP_MIN, this.SPEED_EXP_MAX);
      for (let i = 0; i < ppr; i++) {
        const i2 = i * 2;
        unit[c * 2] = tbl[i2];
        unit[c * 2 + 1] = tbl[i2 + 1];
        rad[c] = r;
        alp[c] = this.seededRand(ri * ppr + i + 1, this.OPACITY_MIN, this.OPACITY_MAX);
        spd[c] = s;
        c++;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aUnit', new THREE.Float32BufferAttribute(unit, 2));
    const rAttr = new THREE.Float32BufferAttribute(rad, 1);
    rAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aRadius', rAttr);
    g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alp, 1));
    g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(spd, 1));

    this.geo = g;
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.matrixAutoUpdate = false;
    this.scene.add(this.points);
    this.prevSpacing = spacing;
    this.prevMinRadius = minR;
    this.setRadiusUniforms(minR, spacing, count);
  }

  private updateLayout(count: number, minR: number, spacing: number): void {
    if (!this.geo || (spacing === this.prevSpacing && minR === this.prevMinRadius)) return;
    const arr = (this.geo.getAttribute('aRadius') as THREE.BufferAttribute).array as Float32Array;
    const ppr = this.PARTICLES_PER_RING;

    let c = 0;
    for (let ri = 0; ri < count; ri++) {
      const r = minR + ri * spacing;
      for (let i = 0; i < ppr; i++) arr[c++] = r;
    }

    (this.geo.getAttribute('aRadius') as THREE.BufferAttribute).needsUpdate = true;
    this.prevSpacing = spacing;
    this.prevMinRadius = minR;
    this.setRadiusUniforms(minR, spacing, count);
  }

  private setRadiusUniforms(minR: number, spacing: number, count: number): void {
    if (!this.uniforms) return;
    this.uniforms['uMinRadius'].value = minR;
    this.uniforms['uRadiusSpan'].value = Math.max(0, (count - 1) * spacing);
  }

  private dispose(): void {
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    if (this.points) this.scene.remove(this.points);
    this.geo?.dispose();
    this.material?.dispose();
    this.points = null;
    this.geo = null;
    this.material = null;
    this.uniforms = null;
    this.ringCount = 0;
    this.prevProgress = -1;
    this.prevRotInput = 0;
    this.accumRotation = 0;
    this.prevSpacing = -1;
    this.prevMinRadius = -1;
    this.prevW = 0;
    this.prevH = 0;
    this.resizeRaf = 0;
  }

  private createMaterial(pixelRatio: number, vs: string, fs: string): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: this.POINT_SIZE * pixelRatio },
        uProgress: { value: 0 },
        uRotationProgress: { value: 0 },
        uIdleRotation: { value: 0 },
        uMinRadius: { value: 0 },
        uRadiusSpan: { value: 1 },
        uFadeIn: { value: 0 },
      },
      vertexShader: vs,
      fragmentShader: fs,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
  }
}