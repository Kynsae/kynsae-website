import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable()
export class PCGeneratedManager {
  private pointMaterial!: THREE.ShaderMaterial;
  private pointCloud!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private explodeElapsed = 0;
  private explosionStarted = false;
  private explosionArmed = false;
  private currentDrawCount = 0;
  private positions!: Float32Array;
  private positionAttr!: THREE.BufferAttribute;
  private modelPositions!: Float32Array;
  private modelPositionAttr!: THREE.BufferAttribute;
  private readonly tmpRay = new THREE.Ray();
  private readonly tmpPlane = new THREE.Plane();
  private readonly tmpWorld = new THREE.Vector3();
  private readonly tmpLocal = new THREE.Vector3();
  private readonly tmpMat4 = new THREE.Matrix4();
  private readonly tmpNormal = new THREE.Vector3(0, 0, -1);
  private targetMouseLocal = new THREE.Vector3(9999, 9999, 9999);
  private lastUpdateTimeMs = performance.now();

  private pendingMouseX: number | null = null;
  private pendingMouseY: number | null = null;
  private hasMouseMoved = false;

  private targetMorph = 0.0;
  private currentMorph = 0.0;

  private readonly TIME_SCALE = 0.0007;
  private readonly POINT_COUNT = 450000;
  private readonly SPHERE_RADIUS = 6.5;
  private readonly EXPLODE_DURATION = 0.13;
  // > 1.0 makes the intro explosion start slower (stronger ease-in) while keeping a smooth settle.
  private readonly EXPLODE_EASE_IN_POWER = 5;
  private readonly MOUSE_INFLUENCE_RADIUS = 4.5;
  private readonly MOUSE_STRENGTH = 0.6;
  private readonly MOUSE_SMOOTH_TIME = 0.2;
  private readonly MORPH_SMOOTH_TIME = 0.08;

  private readonly worker = new Worker(
    new URL('../pc-generated.worker.ts', import.meta.url),
    { type: 'module' }
  );
  private workerMsgId = 0;
  private readonly workerPending = new Map<
    number,
    {
      resolve: (v: Float32Array) => void;
      reject: (e: unknown) => void;
      onProgress?: (p: number) => void;
    }
  >();

  private readonly WORKER_PLY_URL = 'webgl-ressources/models/couldbebetter.ply';

  constructor() {
    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data as
        | { id: number; type: 'progress'; progress: number }
        | { id: number; type: 'result'; result: Float32Array }
        | { id: number; type: 'error'; error: string };

      const pending = this.workerPending.get(data.id);
      if (!pending) return;

      if (data.type === 'progress') {
        pending.onProgress?.(data.progress);
        return;
      }

      this.workerPending.delete(data.id);
      if (data.type === 'result') pending.resolve(data.result);
      else pending.reject(new Error(data.error));
    };
  }

  public destroy(): void {
    this.workerPending.clear();
    this.worker.terminate();
  }

  /**
   * Arms the intro explosion so it starts the moment the point cloud is actually visible.
   * (We intentionally don't auto-start during async loading to avoid finishing under the loader overlay.)
   */
  public armExplosion(): void {
    this.explosionArmed = true;
    this.explosionStarted = false;
    this.explodeElapsed = 0;
    if (this.pointMaterial) {
      this.pointMaterial.uniforms['uRamp'].value = 0.0;
    }
  }

  public init(): THREE.BufferGeometry {
    this.positions = new Float32Array(this.POINT_COUNT * 3);
    this.modelPositions = new Float32Array(this.POINT_COUNT * 3);

    const geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.positionAttr);
    
    this.modelPositionAttr = new THREE.BufferAttribute(this.modelPositions, 3);
    this.modelPositionAttr.setUsage(THREE.StaticDrawUsage);
    geometry.setAttribute('modelPosition', this.modelPositionAttr);
    
    this.currentDrawCount = 0;
    geometry.setDrawRange(0, 0);
    return geometry;
  }

  private callWorker(
    message:
      | Omit<{ id: number; task: 'generateSphere'; pointCount: number; radius: number; seed?: number }, 'id'>
      | Omit<{ id: number; task: 'loadAndSamplePly'; url: string; pointCount: number; sphereTargetRadius: number }, 'id'>,
    onProgress?: (p: number) => void
  ): Promise<Float32Array> {
    const id = ++this.workerMsgId;
    return new Promise<Float32Array>((resolve, reject) => {
      this.workerPending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, ...message });
    });
  }

  public async loadShadersAndCreateMaterial(scene: THREE.Scene, onProgress?: (progress: number) => void): Promise<void> {
    const geometry = this.init();
    const [vertexSource, fragmentSource] = await Promise.all([
      fetch('webgl-ressources/shaders/pc-generated-vertex.glsl').then(r => r.text()),
      fetch('webgl-ressources/shaders/pc-generated-fragment.glsl').then(r => r.text()),
    ]);

    this.pointMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSize: { value: 1.0 },
        uOpacity: { value: 0.6 },
        uTime: { value: 0.0 },
        uMorph: { value: 0.0 },
        uRamp: { value: 0.0 },
        uSphereRadius: { value: this.SPHERE_RADIUS },
        uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
        uMouseRadius: { value: this.MOUSE_INFLUENCE_RADIUS },
        uMouseStrength: { value: this.MOUSE_STRENGTH }
      },
      vertexShader: vertexSource,
      fragmentShader: fragmentSource,
      blending: THREE.AdditiveBlending,
    });

    this.pointCloud = new THREE.Points(geometry, this.pointMaterial);
    this.pointCloud.position.setZ(-4.5);
    scene.add(this.pointCloud);

    // Run heavy CPU work off the main thread
    await Promise.all([
      this.loadAndSampleModel(onProgress),
      this.generateSpherePositions(geometry),
    ]);
  }

  private async loadAndSampleModel(onProgress?: (progress: number) => void): Promise<void> {
    try {
      const remapped = await this.callWorker(
        {
          task: 'loadAndSamplePly',
          url: this.WORKER_PLY_URL,
          pointCount: this.POINT_COUNT,
          sphereTargetRadius: this.SPHERE_RADIUS,
        },
        (p) => onProgress?.(p)
      );
      this.modelPositions.set(remapped);
      this.modelPositionAttr.needsUpdate = true;
      onProgress?.(100);
    } catch {
      this.modelPositions.fill(0);
      this.modelPositionAttr.needsUpdate = true;
      onProgress?.(100);
    }
  }

  private async generateSpherePositions(geometry: THREE.BufferGeometry): Promise<void> {
    const remapped = await this.callWorker({
      task: 'generateSphere',
      pointCount: this.POINT_COUNT,
      radius: this.SPHERE_RADIUS,
      seed: 1,
    });

    this.positions.set(remapped);
    this.positionAttr.needsUpdate = true;
    this.currentDrawCount = this.POINT_COUNT;
    geometry.setDrawRange(0, this.currentDrawCount);
    // Keep ramp at 0 until the component arms the explosion (after the loader is gone).
    this.explodeElapsed = 0.018;
    this.explosionStarted = false;
  }

  public setMorph(morph: number): void {
    if (!this.pointMaterial) return;
    // Clamp morph value and set as target for smooth interpolation
    this.targetMorph = Math.max(0.0, Math.min(1.0, morph));
  }

  public update(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void {
    if (!this.pointMaterial) return;
    
    const uniforms = this.pointMaterial.uniforms;
    uniforms['uTime'].value += this.TIME_SCALE;

    // Start the intro explosion only once it's armed AND we actually have drawable particles.
    if (!this.explosionArmed || this.currentDrawCount <= 0) {
      uniforms['uRamp'].value = 1;
    } else {
      if (!this.explosionStarted) {
        this.explodeElapsed = 0.018;
        this.explosionStarted = true;
      }

      this.explodeElapsed = Math.min(this.EXPLODE_DURATION, this.explodeElapsed + this.TIME_SCALE);
      const tRaw = Math.min(1, Math.max(0, this.explodeElapsed / this.EXPLODE_DURATION));
      const t = tRaw
      // Smoother start + smooth settle.
      // smootherstep(t) = t^3 * (t * (6t - 15) + 10)
      uniforms['uRamp'].value = t * t * t * (t * (6 * t - 15) + 10);
    }

    if (this.hasMouseMoved) {
      this.screenToLocal(this.pendingMouseX!, this.pendingMouseY!, camera, renderer, this.tmpLocal)
      this.targetMouseLocal.copy(this.tmpLocal);
      this.hasMouseMoved = false;
    }

    const now = performance.now();
    const dtMs = Math.max(0, Math.min(100, now - this.lastUpdateTimeMs));
    this.lastUpdateTimeMs = now;

    // Smoothly interpolate morph value to prevent flickering from large scroll steps
    // Use exponential smoothing for smooth transitions even with large input steps
    const morphLerpFactor = 1 - Math.exp(-Math.max(0.000001, dtMs / 1000) / this.MORPH_SMOOTH_TIME);
    this.currentMorph += (this.targetMorph - this.currentMorph) * morphLerpFactor;
    uniforms['uMorph'].value = this.currentMorph;

    uniforms['uMouse'].value.lerp(
      this.targetMouseLocal, 
      1 - Math.exp(-Math.max(0.000001, dtMs / 1000) / this.MOUSE_SMOOTH_TIME)
    );
  }

  public onMouseMove(clientX: number, clientY: number): void {
    this.pendingMouseX = clientX;
    this.pendingMouseY = clientY;
    this.hasMouseMoved = true;
  }

  /**
   * Project a 2D space mouse coordinate system to a 3D space.
   *
   * @param clientX - The mouse X coordinate in client space (e.g., event.clientX)
   * @param clientY - The mouse Y coordinate in client space (e.g., event.clientY)
   * @param camera - The active THREE.PerspectiveCamera viewing the scene
   * @param renderer - The WebGLRenderer used to get the canvas dimensions
   * @param out - Output vector that will contain the local-space coordinates
  */
  private screenToLocal(clientX: number, clientY: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, out: THREE.Vector3): void {
    const rect = renderer.domElement.getBoundingClientRect();

    this.tmpWorld.set(
      ((clientX - rect.left) / rect.width) * 2 - 1, 
      -((clientY - rect.top) / rect.height) * 2 + 1, 
      0.5
    ).unproject(camera);

    this.tmpRay.set(camera.position, this.tmpWorld.sub(camera.position).normalize());

    this.tmpPlane.setFromNormalAndCoplanarPoint(
      this.tmpNormal.applyQuaternion(camera.quaternion), 
      this.pointCloud.getWorldPosition(this.tmpWorld)
    );

    out.copy(this.tmpRay.intersectPlane(this.tmpPlane, this.tmpWorld)!).applyMatrix4(this.tmpMat4.copy(this.pointCloud.matrixWorld).invert());
  }
}