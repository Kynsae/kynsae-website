import { Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, OnDestroy, HostListener, HostBinding, input, effect } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ThreeSceneManager } from '../../../../core/services/three-scene-manager';

@Component({
  selector: 'app-star-exposure',
  templateUrl: './star-exposure.html',
  styleUrl: './star-exposure.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StarExposure implements AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) private containerRef!: ElementRef<HTMLDivElement>;

  public animationProgress = input<number>(0);
  public fov = input<number>(0);
  public trailLength = input<number>(0);

  private readonly STAR_COUNT = window.innerWidth * 6.8;
  private readonly SEGMENTS_PER_STAR = 8;
  private readonly STAR_COLORS = [0x8566db, 0x8a93c1, 0x524d6a, 0xcfccff, 0x4e6497, 0x475880].map(c => new THREE.Color(c));
  private readonly BOUNDING_SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 100);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(180, 1, .001, 200);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private readonly loader = new GLTFLoader();
  private mixer: THREE.AnimationMixer | null = null;
  private loadedCamera: THREE.Camera | null = null;
  private animationAction: THREE.AnimationAction | null = null;
  private animationClip: THREE.AnimationClip | null = null;
  private galaxyMesh: THREE.Mesh | null = null;
  private starParticles: THREE.Points | null = null;
  private uTrailLength: THREE.IUniform | null = null;
  private sceneManager = new ThreeSceneManager();

  @HostBinding('class.star-exposure-visible') private isVisible = false;

  constructor() {
    effect(() => {
      const progress = this.animationProgress();
      const fovVal = this.fov();
      const trailVal = this.trailLength();
      if (this.animationAction && this.animationClip) this.animationAction.time = progress * this.animationClip.duration;
      if (this.starParticles) this.starParticles.visible = progress > 0;
      if (this.galaxyMesh) this.galaxyMesh.visible = progress > 0;
      if (this.camera.fov !== fovVal) {
        this.camera.fov = fovVal;
        this.camera.updateProjectionMatrix();
      }
      if (this.uTrailLength) this.uTrailLength.value = trailVal;
      if (progress <= 0) {
        this.isVisible = false;
        this.sceneManager.stopAnimation();
      } else {
        this.isVisible = true;
        this.sceneManager.startAnimation(this.animate);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const container = this.containerRef.nativeElement;
    const { width, height } = container.getBoundingClientRect();
    this.sceneManager.resizePerspectiveCamera(this.camera, width, height);
    this.sceneManager.resizeRenderer(this.renderer, width, height, 1.3);
    this.renderer.sortObjects = false;
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    const [vertexShader, fragmentShader] = await Promise.all([
      fetch('webgl-ressources/shaders/star-exposure-vertex.glsl').then(r => r.text()),
      fetch('webgl-ressources/shaders/star-exposure-fragment.glsl').then(r => r.text())
    ]);

    const uniforms = this.createUniforms(this.SEGMENTS_PER_STAR);
    this.scene.add(this.createArcs(vertexShader, fragmentShader, uniforms));
    this.starParticles = this.createStarParticles(vertexShader, fragmentShader, uniforms);
    this.scene.add(this.starParticles);
    this.starParticles.visible = false;
    this.loadGLB();
    if (this.animationProgress() > 0) this.sceneManager.startAnimation(this.animate);
  }

  private animate = (): void => {
    this.mixer?.update(0);
    if (this.loadedCamera) {
      this.camera.position.copy(this.loadedCamera.position);
      this.camera.rotation.copy(this.loadedCamera.rotation);
    }
    this.renderer.render(this.scene, this.camera);
  };

  ngOnDestroy(): void {
    this.sceneManager.destroy();
    this.mixer?.uncacheRoot(this.scene);
    this.sceneManager.disposeScene(this.scene);
    this.sceneManager.disposeRenderer(this.renderer, this.containerRef?.nativeElement);
  }

  private loadGLB(): void {
    this.loader.load('cam.glb', (gltf) => {
      gltf.scene.traverse((child) => { this.loadedCamera = child as THREE.Camera; });
      if (this.loadedCamera) {
        this.camera.updateProjectionMatrix();
        this.camera.position.copy(this.loadedCamera.position);
        this.camera.rotation.copy(this.loadedCamera.rotation);
      }
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      this.animationClip = gltf.animations[0];
      this.animationAction = this.mixer.clipAction(this.animationClip);
      this.animationAction.play().paused = true;
    });
  }

  private createStarParticles(vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const indices = new Float32Array(this.STAR_COUNT);
    for (let i = 0; i < this.STAR_COUNT; i++) indices[i] = i;
    const positions = new Float32Array(this.STAR_COUNT * 3);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aIndex', new THREE.Float32BufferAttribute(indices, 1).setUsage(THREE.StaticDrawUsage));
    geometry.boundingSphere = this.BOUNDING_SPHERE;
    const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    points.frustumCulled = false;
    return points;
  }

  private createArcs(vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.Mesh {
    const totalVertices = this.STAR_COUNT * this.SEGMENTS_PER_STAR * 6;
    const vertsPerStar = this.SEGMENTS_PER_STAR * 6;
    const indices = new Float32Array(totalVertices);
    const starIndices = new Float32Array(totalVertices);
    const sides = new Float32Array(totalVertices);
    for (let vi = 0; vi < totalVertices; vi++) {
      const starIndex = (vi / vertsPerStar) | 0;
      const rest = vi % vertsPerStar;
      const segment = (rest / 6) | 0;
      const vq = rest % 6;
      const start = segment / this.SEGMENTS_PER_STAR;
      const end = (segment + 1) / this.SEGMENTS_PER_STAR;
      indices[vi] = starIndex;
      starIndices[vi] = (vq === 0 || vq === 1 || vq === 3) ? start : end;
      sides[vi] = (vq === 1 || vq === 3 || vq === 4) ? 1 : -1;
    }
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(totalVertices * 3);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aIndex', new THREE.Float32BufferAttribute(indices, 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aStarIndex', new THREE.Float32BufferAttribute(starIndices, 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(sides, 1).setUsage(THREE.StaticDrawUsage));
    geometry.boundingSphere = this.BOUNDING_SPHERE;
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide
    });
    this.uTrailLength = material.uniforms['uTrailLength'];
    this.galaxyMesh = new THREE.Mesh(geometry, material);
    return this.galaxyMesh;
  }

  private createUniforms(segmentsPerStar?: number): Record<string, THREE.IUniform> {
    const uniforms: Record<string, THREE.IUniform> = {
      uSize: { value: 1.9 },
      uRadius: { value: 40 },
      uRandomness: { value: 0.32 },
      uRandomnessPower: { value: 2.1 },
      uFlatness: { value: 2.15 },
      uColorCount: { value: this.STAR_COLORS.length },
      uTrailLength: { value: 0.0 },
      uThickness: { value: .05 }
    };
    if (segmentsPerStar != null) uniforms['uSegmentsPerStar'] = { value: segmentsPerStar };
    Object.assign(uniforms, Object.fromEntries(this.STAR_COLORS.map((c, i) => [`uColor${i}`, { value: c }])));
    return uniforms;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.sceneManager.handleResize(() => {
      const { width, height } = this.containerRef.nativeElement.getBoundingClientRect();
      this.sceneManager.resizePerspectiveCamera(this.camera, width, height);
      this.sceneManager.resizeRenderer(this.renderer, width, height, window.devicePixelRatio);
    });
  }
}
