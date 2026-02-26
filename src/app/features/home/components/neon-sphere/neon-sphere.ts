import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-neon-sphere',
  templateUrl: './neon-sphere.html',
  styleUrl: './neon-sphere.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeonSphere implements OnDestroy {
  readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('rendererContainer');

  public readonly ejectProgress = input<number>(0);
  public readonly playIntro = input<boolean>(false);

  private readonly zone = inject(NgZone);

  // ── Shader paths ─────────────────────────────────────────────────────────
  private readonly VS_PATH = 'webgl-ressources/shaders/neon-sphere.vert.glsl';
  private readonly FS_PATH = 'webgl-ressources/shaders/neon-sphere.frag.glsl';

  // ── Scene ───────────────────────────────────────────────────────────────
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly camPos = new THREE.Vector3(0, 0.4, 3.2);
  private readonly ORTHO_SIZE = 2.1;
  private readonly QUALITY_DESKTOP = 0.7;
  private readonly QUALITY_MOBILE = 0.5;
  private readonly CLIPPING_PLANE_OFFSET = 0.27;

  // ── Sphere ──────────────────────────────────────────────────────────────
  private readonly SPHERE_RADIUS = 1.4;
  private readonly SPHERE_RADIUS_MOBILE = 1.8;
  private readonly SPHERE_INIT_ROTATION = new THREE.Euler(
    THREE.MathUtils.degToRad(-50),
    0,
    THREE.MathUtils.degToRad(-20),
  );

  // ── Points ──────────────────────────────────────────────────────────────
  private readonly POINT_COLOR = new THREE.Color(0xa7abec).convertSRGBToLinear();
  private readonly POINT_SIZE = 1.8;

  // ── Slices / Segments ───────────────────────────────────────────────────
  private readonly SLICE_THICKNESS = 0.01;
  private readonly SLICE_MIN_RADIUS = 0.01;
  private readonly SEGMENT_LENGTH = 0.3;
  private readonly SEGMENT_COUNT_MIN = 6;

  // ── Intro animation ─────────────────────────────────────────────────────
  private readonly INTRO_DURATION_MS = 1900;
  private readonly INTRO_START = 0.2;

  // ── Ejection & motion ───────────────────────────────────────────────────
  private readonly EJECT_ROTATION_SPEED = Math.PI * 0.7;

  // ── Math ────────────────────────────────────────────────────────────────
  private readonly tau = Math.PI * 2;

  private readonly renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  });
  private readonly group = new THREE.Group();
  private readonly clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  private readonly MOBILE_BREAKPOINT = 768;

  private geo: THREE.BufferGeometry | null = null;
  private mat: THREE.ShaderMaterial | null = null;
  private pts: THREE.Points | null = null;
  private u: THREE.ShaderMaterial['uniforms'] | null = null;

  private cachedVS = '';
  private cachedFS = '';
  private isMobile = false;

  private ro: ResizeObserver | null = null;
  private resizeQueued = false;
  private raf: number | null = null;
  private t0 = 0;
  private introP = 1;
  private ejectP = 0;

  private clamp01(x: number): number {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  private segs(sr: number): number {
    return Math.max(this.SEGMENT_COUNT_MIN, Math.round((this.tau * sr) / this.SEGMENT_LENGTH));
  }

  constructor() {
    effect(() => {
      const v = this.ejectProgress();
      this.ejectP = Number.isFinite(v) ? v : 0;
      this.zone.runOutsideAngular(() => this.raf === null && this.draw(this.ejectP, this.introP));
    });

    effect(() => {
      const on = !!this.playIntro();
      this.zone.runOutsideAngular(() => {
        if (on) this.startIntro();
        else {
          this.stopIntro();
          this.introP = 1;
          this.draw(this.ejectP, 1);
        }
      });
    });

    afterNextRender(() => this.initScene());
  }

  // ── Scene bootstrap ─────────────────────────────────────────────────────

  private initScene(): void {
    this.zone.runOutsideAngular(async () => {
      const r = this.renderer;
      r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      r.setClearColor(0, 0);
      r.localClippingEnabled = true;

      this.scene.add(this.group);
      this.group.rotation.copy(this.SPHERE_INIT_ROTATION);

      this.camera.position.copy(this.camPos);
      this.camera.lookAt(0, 0, 0);

      const n = new THREE.Vector3();
      this.camera.getWorldDirection(n).negate();
      this.clipPlane.setFromNormalAndCoplanarPoint(n, n.clone().multiplyScalar(-this.CLIPPING_PLANE_OFFSET));

      const el = this.containerRef().nativeElement;
      Object.assign(r.domElement.style, { display: 'block', width: '100%', height: '100%' });
      el.appendChild(r.domElement);
      this.resize();

      this.ro = new ResizeObserver(() => this.queueResize());
      this.ro.observe(el);

      const [vs, fs] = await Promise.all([
        fetch(this.VS_PATH).then((r) => r.text()),
        fetch(this.FS_PATH).then((r) => r.text()),
      ]);
      this.cachedVS = vs;
      this.cachedFS = fs;
      this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
      this.build(vs, fs);
      this.draw(0, 1);
    });
  }

  // ── Point cloud construction ────────────────────────────────────────────

  private build(vs: string, fs: string): void {
    if (this.pts) this.group.remove(this.pts);
    this.geo?.dispose();
    this.mat?.dispose();
    this.pts = null;
    this.geo = null;
    this.mat = null;
    this.u = null;

    const q = this.isMobile ? this.QUALITY_MOBILE : this.QUALITY_DESKTOP;
    const R = this.isMobile ? this.SPHERE_RADIUS_MOBILE : this.SPHERE_RADIUS;
    const sliceN = Math.max(20, (70 * q) | 0);
    const tgtPPS = Math.max(2000, (7000 * q) | 0);
    const inv = 1 / sliceN;

    let n = 0;
    for (let i = 0; i <= sliceN; i++) {
      const sr = Math.sin(i * inv * Math.PI) * R;
      if (sr > this.SLICE_MIN_RADIUS) {
        const s = this.segs(sr);
        n += s * ((tgtPPS / s) | 0);
      }
    }
    if (!n) return;

    const pos = new Float32Array(n * 3);
    const seg0 = new Float32Array(n * 3);
    const seed = new Float32Array(n);

    let k = 0;
    for (let i = 0; i <= sliceN; i++) {
      const t = i * inv,
        th = t * Math.PI;
      const baseY = Math.cos(th) * R;
      const sr = Math.sin(th) * R;
      if (sr <= this.SLICE_MIN_RADIUS) continue;

      const segN = this.segs(sr);
      const pps = (tgtPPS / segN) | 0;

      for (let si = 0; si < segN; si++) {
        const as = (si / segN) * this.tau;
        const ae = ((si + 1) / segN) * this.tau;
        const mid = (as + ae) * 0.5;

        for (let p = 0; p < pps; p++, k++) {
          const a = as + Math.random() * (ae - as);
          const rj = (Math.random() - 0.5) * this.SLICE_THICKNESS;
          const o3 = k * 3;

          pos[o3] = Math.cos(a) * (sr + rj);
          pos[o3 + 1] = (Math.random() - 0.5) * this.SLICE_THICKNESS;
          pos[o3 + 2] = Math.sin(a) * (sr + rj);

          seg0[o3] = baseY;
          seg0[o3 + 1] = sr;
          seg0[o3 + 2] = mid;

          seed[k] = Math.random() * 1000;
        }
      }
    }

    const g = new THREE.BufferGeometry();
    const set = (name: string, arr: Float32Array, size: number) =>
      g.setAttribute(name, new THREE.BufferAttribute(arr, size));
    set('position', pos, 3);
    set('aSeg0', seg0, 3);
    set('aSeed', seed, 1);

    const m = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      clipping: true,
      clippingPlanes: [this.clipPlane],
      uniforms: {
        uProgress: { value: 0 },
        uCosRot: { value: 1 },
        uSinRot: { value: 0 },
        uIntroDone: { value: 1 },
        uIntroProgress: { value: 1 },
        uPointSize: { value: this.POINT_SIZE },
        uColor: { value: this.POINT_COLOR },
      },
      vertexShader: vs,
      fragmentShader: fs,
    });

    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;

    this.geo = g;
    this.mat = m;
    this.u = m.uniforms;
    this.pts = pts;
    this.group.add(pts);
  }

  // ── Intro animation ─────────────────────────────────────────────────────

  private startIntro(): void {
    if (!this.u) {
      this.introP = 0;
      return;
    }
    this.stopIntro();
    this.t0 = 0;
    this.introP = 0;

    const tick = (t: number) => {
      if (!this.t0) this.t0 = t;
      const p = THREE.MathUtils.clamp((t - this.t0) / this.INTRO_DURATION_MS, 0, 1);
      this.introP = this.INTRO_START + (1 - this.INTRO_START) * Math.sin((p * Math.PI) / 2);
      this.draw(this.ejectP, this.introP);
      if (p >= 1) {
        this.raf = null;
        this.introP = 1;
        this.draw(this.ejectP, 1);
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopIntro(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  private draw(ejectP: number, introP: number): void {
    const ep = this.clamp01(ejectP);
    const ip = this.clamp01(introP);
    const ry = this.SPHERE_INIT_ROTATION.y + ep * this.EJECT_ROTATION_SPEED;

    this.group.rotation.set(this.SPHERE_INIT_ROTATION.x, ry, this.SPHERE_INIT_ROTATION.z);

    if (this.u) {
      (this.u['uProgress'] as THREE.IUniform<number>).value = ep;
      (this.u['uIntroProgress'] as THREE.IUniform<number>).value = ip;
      (this.u['uCosRot'] as THREE.IUniform<number>).value = Math.cos(ry);
      (this.u['uSinRot'] as THREE.IUniform<number>).value = Math.sin(ry);
      (this.u['uIntroDone'] as THREE.IUniform<number>).value = ip >= 0.999 ? 1 : 0;
    }
    this.renderer.render(this.scene, this.camera);
  }

  // ── Resize ──────────────────────────────────────────────────────────────

  private resize(): void {
    const el = this.containerRef().nativeElement;
    const w = Math.max(1, el.clientWidth | 0);
    const h = Math.max(1, el.clientHeight | 0);
    const a = w / h;

    // On portrait viewports, scale up ortho size so the sphere fits within the narrower width
    const s = a >= 1 ? this.ORTHO_SIZE : this.ORTHO_SIZE / a;

    this.camera.left = -s * a;
    this.camera.right = s * a;
    this.camera.top = s;
    this.camera.bottom = -s;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private queueResize(): void {
    if (this.resizeQueued) return;
    this.resizeQueued = true;
    requestAnimationFrame(() => {
      this.resizeQueued = false;
      this.resize();

      const mobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
      if (mobile !== this.isMobile && this.cachedVS) {
        this.isMobile = mobile;
        this.build(this.cachedVS, this.cachedFS);
      }

      this.renderer.render(this.scene, this.camera);
    });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.dispose();
  }

  private dispose(): void {
    this.zone.runOutsideAngular(() => {
      this.stopIntro();
      this.ro?.disconnect();
      if (this.pts) this.group.remove(this.pts);
      this.geo?.dispose();
      this.mat?.dispose();
      this.renderer.dispose();
      this.renderer.domElement.remove();
      this.u = null;
      this.pts = null;
      this.mat = null;
      this.geo = null;
      this.ro = null;
    });
  }
}