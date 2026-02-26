import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { ThreeSceneManager } from '../../../../../core/services/three-scene-manager';

@Injectable()
export class TorusEngine {
  private readonly TORUS_RADIUS = 2;
  private readonly TORUS_TUBE = 0.3;
  private readonly TORUS_SEGMENTS = 32;
  private readonly TORUS_TUBE_SEGMENTS = 100;
  private readonly TORUS_MAJOR_SCALE = 0.95;
  private readonly CENTER_TEXT_MARGIN_PX = 90;
  private readonly CENTER_TEXT_INTRO_MIN_SCALE = 0.5;

  private readonly INPUT_YAW_INVERT = 2;
  private readonly INPUT_PITCH_INVERT = 2;

  private readonly PHYSICS_DAMPING = 0.98;
  private readonly PHYSICS_IMPULSE_SCALE = .15;
  private readonly PHYSICS_MIN_VELOCITY = 0.0001;
  private readonly PHYSICS_MAX_ANGULAR_SPEED = 0.035;
  private readonly PHYSICS_ACCELERATION = 0.1;
  private readonly PHYSICS_DECELERATION = 0.86;
  private readonly PHYSICS_MOUSE_SENSITIVITY = 0.001;
  private readonly PHYSICS_VELOCITY_SCALING = 0.1;
  private readonly COLLISION_SUBSTEP_MAX = 5;
  private readonly COLLISION_SUBSTEP_ANGLE = 0.01;

  private readonly IDLE_ROTATION_SPEED_Z = 0.002;

  private isIntroPlaying = false; // Start disabled, will be enabled after loading completes
  private introInitialized = false;
  private introEnabled = false;
  private introStartTime = 0;
  private introDurationMs = 1900;
  private isFadingInCenterText = false;
  private hasTriggeredCenterTextFade = false;
  private fadeStartTime = 0;
  private fadeDurationMs = 1000;
  private INTRO_TARGET_EULER = new THREE.Euler(10.5, -0.6, 0.0, 'XYZ');

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: true, premultipliedAlpha: false });
  private sceneManager = new ThreeSceneManager();

  private torus!: THREE.Mesh<THREE.TorusGeometry, THREE.MeshPhysicalMaterial>;
  private torusRadius = this.TORUS_RADIUS;
  private centerTextWorldBox?: THREE.Box3;
  private centerText?: THREE.Mesh;
  private centerTextBaseScale = 1;
  private centerTextScaleFactor = this.CENTER_TEXT_INTRO_MIN_SCALE;

  private lastMouse = new THREE.Vector2();
  private isHovering = false;
  private mouseVelocity = new THREE.Vector2(0, 0);
  private angularVelocity = new THREE.Vector2(0, 0);
  private tmpVecA = new THREE.Vector3();
  private tmpVecB = new THREE.Vector3();
  private worldXAxis = new THREE.Vector3(1, 0, 0);
  private worldYAxis = new THREE.Vector3(0, 1, 0);
  private worldZAxis = new THREE.Vector3(0, 0, 1);
  private tmpQuatA = new THREE.Quaternion();
  private tmpQuatB = new THREE.Quaternion();
  private idleQuat = new THREE.Quaternion();
  private collisionCooldownUntil = 0;
  private introTargetQuat = new THREE.Quaternion();
  private introStartQuat = new THREE.Quaternion();
  private introInterpQuat = new THREE.Quaternion();
  private idleZAngle = 0;
  private readonly INTRO_TURNS_X = 0.75;
  private readonly INTRO_TURNS_Y = 1.5;
  private readonly INTRO_WOBBLE_MAX_X = 0.9;
  private readonly INTRO_WOBBLE_MAX_Y = 0.4;
  private raycaster = new THREE.Raycaster();
  private readonly HOVER_RAYCAST_MIN_INTERVAL_MS = 16; // cap hover tests to ~1/frame
  private lastHoverRaycastAt = 0;
  private pointerNdc = new THREE.Vector2();
  private pointerInside = false;
  private pointerDirty = false;
  private raycastHits: THREE.Intersection[] = [];

  private torusCollider?: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly TORUS_COLLIDER_SEGMENTS = 100;
  private readonly TORUS_COLLIDER_TUBE_SEGMENTS = 100;

  public init(containerEl: HTMLDivElement, resp: any, onProgress?: (progress: number) => void): void { 
    this.initScene(containerEl, onProgress);

    this.torus.add(resp.mesh);
    this.updateTorusRadius(resp.rCurve * this.TORUS_MAJOR_SCALE);
    this.setCenterTextMesh(resp.centerMesh);

    this.resize();
    
    // Signal completion
    onProgress?.(100);
  }

  private initScene(containerEl: HTMLDivElement, onProgress?: (progress: number) => void) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.sceneManager.resizeRenderer(this.renderer, w, h);
    this.sceneManager.resizeOrthographicCamera(this.camera, w, h, 2);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    containerEl.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 0, 4);

    const geometry = new THREE.TorusGeometry(
      this.TORUS_RADIUS * this.TORUS_MAJOR_SCALE,
      this.TORUS_TUBE,
      this.TORUS_SEGMENTS,
      this.TORUS_TUBE_SEGMENTS
    );

    // Track loading progress for resources
    let normalMapLoaded = false;
    let hdrLoaded = false;
    const updateProgress = () => {
      const normalMapProgress = normalMapLoaded ? 50 : 0;
      const hdrProgress = hdrLoaded ? 50 : 0;
      const totalProgress = normalMapProgress + hdrProgress;
      onProgress?.(totalProgress);
    };

    const textureLoader = new THREE.TextureLoader();
    const normalMap = textureLoader.load(
      'webgl-ressources/other/torus-normal-map.webp',
      () => {
        normalMapLoaded = true;
        updateProgress();
      },
      undefined,
      (error) => {
        console.error('Error loading normal map:', error);
        normalMapLoaded = true; // Mark as loaded even on error to continue
        updateProgress();
      }
    );

    const material = new THREE.MeshPhysicalMaterial({
      roughness: 0,
      transmission: 2,
      thickness: 2.0,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(2, 0),
      envMapIntensity: 0.4
    });

    new HDRLoader().load(
      'webgl-ressources/other/torus-backdrop.hdr',
      (hdr) => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        material.envMap = hdr;
        hdrLoaded = true;
        updateProgress();
      },
      undefined,
      (error) => {
        console.error('Error loading HDR:', error);
        hdrLoaded = true; // Mark as loaded even on error to continue
        updateProgress();
      }
    );

    this.torus = new THREE.Mesh(geometry, material);
    this.scene.add(this.torus);

    // Low-poly collider for raycasting (drastically reduces raycast cost vs the high-res render geometry).
    const colliderGeom = new THREE.TorusGeometry(
      this.TORUS_RADIUS * this.TORUS_MAJOR_SCALE,
      this.TORUS_TUBE,
      this.TORUS_COLLIDER_SEGMENTS,
      this.TORUS_COLLIDER_TUBE_SEGMENTS
    );
    const colliderMat = new THREE.MeshBasicMaterial({ visible: false });
    this.torusCollider = new THREE.Mesh(colliderGeom, colliderMat);
    this.torus.add(this.torusCollider);
  }

  start(): void {
    this.sceneManager.startAnimation(() => {
      this.updateFrame();
      this.renderer.render(this.scene, this.camera);
    });
  }

  enableIntroAnimation(): void {
    this.introEnabled = true;
    this.isIntroPlaying = true;
  }

  stop(): void {
    this.sceneManager.stopAnimation();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.sceneManager.resizeRenderer(this.renderer, w, h);
    this.sceneManager.resizeOrthographicCamera(this.camera, w, h, 2);
    this.fitCenterTextToViewport();
  }

  dispose(containerEl?: HTMLDivElement): void {
    this.sceneManager.destroy();
    
    // Dispose torus geometry and material
    if (this.torus) {
      try {
        this.torus.geometry.dispose();
        this.torus.material.dispose();
      } catch (e) {
        // Already disposed
      }
    }

    if (this.torusCollider) {
      try {
        this.torusCollider.geometry.dispose();
        this.torusCollider.material.dispose();
      } catch (e) {
        // Already disposed
      } finally {
        this.torusCollider = undefined;
      }
    }
    
    this.sceneManager.disposeScene(this.scene);
    this.sceneManager.disposeRenderer(this.renderer, containerEl);
  }

  private setTorusThickness(thickness: number): void {
    this.torus.material.thickness = thickness;
  }

  private setCenterTextMesh(mesh: THREE.Mesh): void {
    this.centerText = mesh;
    const material = mesh.material as any;
    if (material) {
      material.transparent = true;
      material.opacity = 0;
    }
    this.scene.add(mesh);
    this.fitCenterTextToViewport();
  }

  private setCenterTextOpacity(alpha: number): void {
    if (!this.centerText) return;
    const material = this.centerText.material as any;
    if (!material) return;
    material.transparent = true;
    material.opacity = THREE.MathUtils.clamp(alpha, 0, 1);
    this.centerText.visible = material.opacity > 0.0001;
  }

  updateTorusRadius(newRadius: number): void {
    if (!this.torus || Math.abs(newRadius - this.torusRadius) <= 1e-4) return;
    this.torus.geometry.dispose();
    this.torus.geometry = new THREE.TorusGeometry(newRadius, this.TORUS_TUBE, this.TORUS_SEGMENTS, this.TORUS_TUBE_SEGMENTS);
    if (this.torusCollider) {
      this.torusCollider.geometry.dispose();
      this.torusCollider.geometry = new THREE.TorusGeometry(newRadius, this.TORUS_TUBE, this.TORUS_COLLIDER_SEGMENTS, this.TORUS_COLLIDER_TUBE_SEGMENTS);
    }
    this.torusRadius = newRadius;
  }

  private setCenterTextWorldBoxFrom(obj: THREE.Object3D) {
    obj.updateMatrixWorld(true);
    this.centerTextWorldBox = new THREE.Box3().setFromObject(obj);
  }

  onPointerMove(ev: MouseEvent | PointerEvent, containerEl: HTMLDivElement) {
    if (!containerEl) return;

    // Pointer events are attached directly to the container; use offsetX/Y (no layout reads).
    // Fall back to clientX/Y if offsetX/Y is unavailable for some reason.
    const anyEv = ev as any;
    const w = Math.max(1, containerEl.clientWidth || 1);
    const h = Math.max(1, containerEl.clientHeight || 1);
    const x = typeof anyEv.offsetX === 'number' ? anyEv.offsetX : anyEv.clientX;
    const y = typeof anyEv.offsetY === 'number' ? anyEv.offsetY : anyEv.clientY;

    const inside = x >= 0 && y >= 0 && x <= w && y <= h;
    this.pointerInside = inside;
    if (inside) {
      this.pointerNdc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
      this.pointerDirty = true;
    } else {
      this.isHovering = false;
      this.pointerDirty = false;
    }

    const dx = ev.clientX - this.lastMouse.x;
    const dy = ev.clientY - this.lastMouse.y;
    if (this.isHovering) {
      this.mouseVelocity.x = THREE.MathUtils.lerp(this.mouseVelocity.x, dx, this.PHYSICS_ACCELERATION);
      this.mouseVelocity.y = THREE.MathUtils.lerp(this.mouseVelocity.y, dy, this.PHYSICS_ACCELERATION);
      const mouseSensitivity = this.PHYSICS_IMPULSE_SCALE * this.PHYSICS_MOUSE_SENSITIVITY;
      const velocityMagnitude = this.mouseVelocity.length();
      const scaledSensitivity = mouseSensitivity * (1 + velocityMagnitude * this.PHYSICS_VELOCITY_SCALING);
      this.angularVelocity.x += this.mouseVelocity.y * scaledSensitivity * this.INPUT_PITCH_INVERT;
      this.angularVelocity.y += this.mouseVelocity.x * scaledSensitivity * this.INPUT_YAW_INVERT;
      this.clampAngularSpeed();
      this.mouseVelocity.multiplyScalar(this.PHYSICS_DECELERATION);
    } else {
      this.mouseVelocity.set(0, 0);
    }
    this.lastMouse.set(ev.clientX, ev.clientY);
  }

  onPointerLeave() {
    this.pointerInside = false;
    this.pointerDirty = false;
    this.isHovering = false;
    this.mouseVelocity.set(0, 0);
  }

  public isPointerOnTorus(ev: MouseEvent | PointerEvent, containerEl: HTMLDivElement): boolean {
    if (!containerEl || !this.torus) return false;
    const anyEv = ev as any;
    const w = Math.max(1, containerEl.clientWidth || 1);
    const h = Math.max(1, containerEl.clientHeight || 1);
    const x = typeof anyEv.offsetX === 'number' ? anyEv.offsetX : anyEv.clientX;
    const y = typeof anyEv.offsetY === 'number' ? anyEv.offsetY : anyEv.clientY;
    if (x < 0 || y < 0 || x > w || y > h) return false;

    this.pointerNdc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    this.raycastHits.length = 0;
    const target = this.torusCollider ?? this.torus;
    this.raycaster.intersectObject(target, false, this.raycastHits);
    return this.raycastHits.length > 0;
  }

  private updateFrame() {
    const now = performance.now();
    this.idleZAngle += this.IDLE_ROTATION_SPEED_Z;
    const torus = this.torus;
    if (!torus) return;

    // Hover test: once per frame max, raycast against low-poly collider only.
    if (this.pointerInside && this.pointerDirty && now - this.lastHoverRaycastAt >= this.HOVER_RAYCAST_MIN_INTERVAL_MS) {
      this.lastHoverRaycastAt = now;
      this.pointerDirty = false;
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      this.raycastHits.length = 0;
      const target = this.torusCollider ?? torus;
      this.raycaster.intersectObject(target, false, this.raycastHits);
      this.isHovering = this.raycastHits.length > 0;
    } else if (!this.pointerInside) {
      this.isHovering = false;
    }

    // Don't start intro animation until explicitly enabled
    if (!this.introEnabled) {
      // Keep torus in initial state until intro is enabled
      return;
    }

    if (this.isIntroPlaying) {
      if (!this.introInitialized) {
        this.introInitialized = true;
        this.introStartTime = now;
        this.introTargetQuat.setFromEuler(this.INTRO_TARGET_EULER);
        torus.quaternion.identity();
        torus.updateMatrixWorld(true);
        this.introStartQuat.copy(torus.quaternion);
        this.angularVelocity.set(0, 0);
      }
      const t = Math.min(1, (now - this.introStartTime) / this.introDurationMs);
      const t2 = t * t;
      const t3 = t2 * t;
      const tSmoothQuintic = t3 * (t * (6 * t - 15) + 10);
      const tEase = 1 - Math.pow(1 - tSmoothQuintic, 3); // stronger ease-out
      this.introInterpQuat.slerpQuaternions(this.introStartQuat, this.introTargetQuat, tEase);
      const wobbleEnvelope = Math.pow(1 - tEase, 1.5);
      const extraX = this.INTRO_WOBBLE_MAX_X * Math.sin((Math.PI * 2) * this.INTRO_TURNS_X * tEase) * wobbleEnvelope;
      const extraY = this.INTRO_WOBBLE_MAX_Y * Math.sin((Math.PI * 2) * this.INTRO_TURNS_Y * tEase + Math.PI) * wobbleEnvelope;
      this.tmpQuatA.setFromAxisAngle(this.worldXAxis, extraX);
      this.tmpQuatB.setFromAxisAngle(this.worldYAxis, extraY);
      torus.quaternion.copy(this.introInterpQuat);
      torus.quaternion.multiply(this.tmpQuatA);
      torus.quaternion.multiply(this.tmpQuatB);
      this.tmpQuatA.setFromAxisAngle(this.worldZAxis, this.idleZAngle);
      torus.quaternion.multiply(this.tmpQuatA);
      torus.updateMatrixWorld(true);

      const thickness = THREE.MathUtils.lerp(1.0, 0.3, tEase);
      this.setTorusThickness(thickness);

      if (!this.hasTriggeredCenterTextFade && !this.isFadingInCenterText && tEase >= 0.55) {
        this.isFadingInCenterText = true;
        this.hasTriggeredCenterTextFade = true;
        this.fadeStartTime = now;
      }
      if (t >= 1) {
        this.tmpQuatA.setFromAxisAngle(this.worldZAxis, this.idleZAngle);
        torus.quaternion.copy(this.introTargetQuat);
        torus.quaternion.multiply(this.tmpQuatA);
        torus.updateMatrixWorld(true);
        this.isIntroPlaying = false;
        this.angularVelocity.set(0, 0);
        this.setTorusThickness(0.3);
      }
    } else {
      torus.rotateZ(this.IDLE_ROTATION_SPEED_Z);
      this.idleQuat.copy(torus.quaternion);
      const centerBox = this.centerTextWorldBox;
      const speed = this.angularVelocity.length();
      const substeps = Math.max(1, Math.min(this.COLLISION_SUBSTEP_MAX, Math.ceil(speed / Math.max(1e-8, this.COLLISION_SUBSTEP_ANGLE))));
      const stepX = this.angularVelocity.x / substeps;
      const stepY = this.angularVelocity.y / substeps;
      for (let i = 0; i < substeps; i++) {
        if (stepY !== 0) {
          this.tmpQuatA.setFromAxisAngle(this.worldYAxis, stepY);
          torus.quaternion.premultiply(this.tmpQuatA);
        }
        if (stepX !== 0) {
          this.tmpQuatB.setFromAxisAngle(this.worldXAxis, stepX);
          torus.quaternion.premultiply(this.tmpQuatB);
        }
        torus.updateMatrixWorld(true);
        if (centerBox && now >= this.collisionCooldownUntil && this.checkTorusCenterTextCollision(centerBox)) {
          const prevAx = this.angularVelocity.x;
          const prevAy = this.angularVelocity.y;
          this.applyBounceFromCollision(prevAx, prevAy, now);
          break;
        }
      }
    }

    if (!this.isIntroPlaying) {
      this.angularVelocity.multiplyScalar(this.PHYSICS_DAMPING);
      if (Math.abs(this.angularVelocity.x) < this.PHYSICS_MIN_VELOCITY) this.angularVelocity.x = 0;
      if (Math.abs(this.angularVelocity.y) < this.PHYSICS_MIN_VELOCITY) this.angularVelocity.y = 0;
      this.clampAngularSpeed();
    }

    if (this.isFadingInCenterText) {
      const ft = Math.min(1, (now - this.fadeStartTime) / this.fadeDurationMs);
      const ftEase = 1 - Math.pow(1 - ft, 3); // ease-out for smoother feel
      this.setCenterTextOpacity(ftEase);
      // Scale center text from 0.5 to 1.0 during fade-in with ease-out
      this.centerTextScaleFactor = THREE.MathUtils.lerp(this.CENTER_TEXT_INTRO_MIN_SCALE, 1.0, ftEase);
      if (this.centerText) {
        this.centerText.scale.setScalar(this.centerTextBaseScale * this.centerTextScaleFactor);
        this.centerText.updateMatrixWorld(true);
        // Keep collision bounds in sync while the center text is animating.
        this.setCenterTextWorldBoxFrom(this.centerText);
      }
      if (ft >= 1) this.isFadingInCenterText = false;
    }
  }

  private clampAngularSpeed() {
    const max = this.PHYSICS_MAX_ANGULAR_SPEED;
    const len = this.angularVelocity.length();
    if (len > max) this.angularVelocity.multiplyScalar(max / Math.max(1e-8, len));
  }

  private checkTorusCenterTextCollision(centerTextWorldBox: THREE.Box3): boolean {
    const torus = this.torus;
    const majorRadius = this.torusRadius;
    const tubeRadius = this.TORUS_TUBE;
    // Higher sample count makes collision feel continuous (less "steppy") without being expensive.
    const samples = 128;
    const radiusWithMargin = tubeRadius + 0.006;
    const radiusWithMarginSq = radiusWithMargin * radiusWithMargin;
    for (let i = 0; i < samples; i++) {
      const theta = (i / samples) * Math.PI * 2;
      this.tmpVecA.set(Math.cos(theta) * majorRadius, Math.sin(theta) * majorRadius, 0);
      torus.localToWorld(this.tmpVecA);
      centerTextWorldBox.clampPoint(this.tmpVecA, this.tmpVecB);
      if (this.tmpVecA.distanceToSquared(this.tmpVecB) <= radiusWithMarginSq) return true;
    }
    return false;
  }

  private applyBounceFromCollision(prevAx: number, prevAy: number, now: number) {
    if (!this.torus) return;
    this.torus.quaternion.copy(this.idleQuat);
    const nudge = 0.015;
    if (prevAy !== 0) {
      this.tmpQuatA.setFromAxisAngle(this.worldYAxis, -Math.sign(prevAy) * nudge);
      this.torus.quaternion.premultiply(this.tmpQuatA);
    }
    if (prevAx !== 0) {
      this.tmpQuatB.setFromAxisAngle(this.worldXAxis, -Math.sign(prevAx) * nudge);
      this.torus.quaternion.premultiply(this.tmpQuatB);
    }
    this.torus.updateMatrixWorld(true);
    this.angularVelocity.multiplyScalar(-0.8);
    this.clampAngularSpeed();
    this.collisionCooldownUntil = now + 180;
  }

  private fitCenterTextToViewport() {
    if (!this.centerText || !(this.camera instanceof THREE.OrthographicCamera)) return;
    const geom = this.centerText.geometry as THREE.BufferGeometry;
    if (!geom) return;
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (!bb) return;
    const textWidth = Math.max(1e-8, bb.max.x - bb.min.x);
    const textHeight = Math.max(1e-8, bb.max.y - bb.min.y);

    const worldWidth = this.camera.right - this.camera.left;
    const worldHeight = this.camera.top - this.camera.bottom;
    const canvas = this.renderer.domElement as HTMLCanvasElement;
    const cssWidth = Math.max(1, canvas?.clientWidth || window.innerWidth);
    const cssHeight = Math.max(1, canvas?.clientHeight || window.innerHeight);
    const marginPx = this.CENTER_TEXT_MARGIN_PX;

    // Convert a margin in CSS pixels to world units for both axes
    const marginWorldX = (marginPx * worldWidth) / cssWidth;
    const marginWorldY = (marginPx * worldHeight) / cssHeight;

    const targetWidth = Math.max(1e-8, worldWidth - marginWorldX);
    const targetHeight = Math.max(1e-8, worldHeight - marginWorldY);

    const scale = Math.min(targetWidth / textWidth, targetHeight / textHeight);
    this.centerTextBaseScale = scale;
    this.centerText.scale.setScalar(this.centerTextBaseScale * this.centerTextScaleFactor);
    this.centerText.position.set(0, 0, 0);
    this.centerText.updateMatrixWorld(true);
    this.setCenterTextWorldBoxFrom(this.centerText);
  }
}