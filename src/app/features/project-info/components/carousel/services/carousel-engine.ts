import { Injectable } from '@angular/core';
import { Project } from '../../../../../shared/models/project.model';
import * as THREE from 'three';
import { ThreeSceneManager } from '../../../../../core/services/three-scene-manager';

@Injectable()
export class CarouselEngine {
  private renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: true });
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private scene = new THREE.Scene();
  private group: THREE.Group | null = null;
  private textures: THREE.Texture[] = [];
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private sceneManager = new ThreeSceneManager();
  private containerEl!: HTMLElement;
  private totalWidth = 0; // unscaled content width in world units
  private onProgress?: (percent: number) => void;
  private lastProgress: number | null = null;

  private velocityX = 0;
  private baseHeight = 1;
  private verticalPadding = 0.1; // 8% top and 8% bottom margin inside canvas
  private planeScale = 0.9; // scale planes relative to available height (reduce base size)
  private distortionIntensity = 0; // 0..1 eased intensity based on scroll speed
  private readonly HORIZONTAL_GAP = 0.08; // spacing between planes in world units
  private readonly DISTORTION_STRENGTH = -0.5; // fraction of plane height used for max forward displacement
  private readonly MAX_SPEED_FOR_FULL_DISTORTION = .4; // world units/frame mapping to intensity=1
  private readonly LEFT_MARGIN_FRACTION = 0.5; // reserve a fraction of viewport width as left margin
  private readonly LEFT_MARGIN_MIN_PX = 600; // ensure a minimum left margin in pixels
  private readonly RIGHT_MARGIN_FRACTION = 0.17; // right margin as fraction of viewport width when scrolled to end
  private readonly WHEEL_SCROLL_SCALE = 0.15; // lower = slower scroll from mouse wheel
  private readonly INPUT_ACCELERATION_FACTOR = 5; // how strongly wheel deltas affect momentum
  private readonly MAX_VELOCITY = 5; // cap momentum speed

  private readonly EDGE_SOFT_ZONE = 0.15; // start slowing down this fraction of viewport before edge
  private readonly OVERSCROLL_DAMPING = 0.3; // resistance factor when past edge (lower = more resistance)
  private readonly OVERSCROLL_MAX = 0.1; // max overscroll distance as fraction of frustum width
  private readonly SPRING_STIFFNESS = 0.1; // how quickly it springs back (higher = faster)
  
  public init(container: HTMLElement, medias: Project['medias'], onProgress?: (percent: number) => void): void {
    if (this.sceneManager.destroyed || this.group) {
      this.destroy();
    }
    this.containerEl = container;
    this.onProgress = onProgress;
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.sceneManager.resizeRenderer(this.renderer, w, h, 1.6);
    this.camera.position.z = 4;
    
    container.appendChild(this.renderer.domElement);
    this.resize();

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Make each image plane slightly smaller than frustum height to keep vertical margins
    const frustumHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const targetHeight = frustumHeight * (1 - 2 * this.verticalPadding);
    this.baseHeight = targetHeight * this.planeScale;
    
    // Build planes synchronously with placeholders, textures load async
    this.buildPlanes(medias || [], this.baseHeight);
    this.renderer.render(this.scene, this.camera);

    this.attachScroll(container);
    this.emitProgressIfChanged(true);
    this.sceneManager.startAnimation(this.animate);
  }

  private buildPlanes(medias: Project['medias'], baseHeight: number): void {
    const loader = new THREE.TextureLoader();

    // Default aspect ratio for placeholder planes before actual dimensions are known
    const defaultAspect = 16 / 9;
    const defaultWidth = baseHeight * defaultAspect;

    // Create a black placeholder texture
    const createPlaceholderTexture = (): THREE.DataTexture => {
      const data = new Uint8Array([0, 0, 0, 255]); // Black
      const tex = new THREE.DataTexture(data, 1, 1);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    // Create placeholder plane with red material
    const createPlaceholderPlane = (width: number, height: number, isVideo: boolean): { mesh: THREE.Mesh; geo: THREE.PlaneGeometry; mat: THREE.MeshBasicMaterial } => {
      const geo = new THREE.PlaneGeometry(width, height, ...(isVideo ? [12, 8] : [300, 300]));
      const placeholderTex = createPlaceholderTexture();
      const mat = new THREE.MeshBasicMaterial({ map: placeholderTex, transparent: true });

      mat.onBeforeCompile = (shader: any) => {
        shader.uniforms.uLensRadius = { value: 0 };
        shader.uniforms.uLensXScale = { value: 0 };
        shader.uniforms.uLensYScale = { value: 0 };
        shader.uniforms.uLensMaxZ = { value: 0 };
        
        mat.userData['uLensRadiusUniform'] = shader.uniforms.uLensRadius;
        mat.userData['uLensXScaleUniform'] = shader.uniforms.uLensXScale;
        mat.userData['uLensYScaleUniform'] = shader.uniforms.uLensYScale;
        mat.userData['uLensMaxZUniform'] = shader.uniforms.uLensMaxZ;

        shader.vertexShader = shader.vertexShader
          .replace(
            'void main() {',
            'uniform float uLensRadius;\nuniform float uLensXScale;\nuniform float uLensYScale;\nuniform float uLensMaxZ;\nvoid main() {'
          )
          .replace(
            '#include <begin_vertex>',
            (
              'vec3 displaced = position;\n' +
              'vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);\n' +
              'vec4 clipPos = projectionMatrix * mvPos;\n' +
              'vec2 ndc = clipPos.xy / max(clipPos.w, 1e-6);\n' +
              'float r = length(vec2(ndc.x / uLensXScale, ndc.y / uLensYScale));\n' +
              'float t = max(0.0, 1.0 - r / uLensRadius);\n' +
              'float weight = t * t * (3.0 - 2.0 * t);\n' +
              'displaced.z += uLensMaxZ * weight;\n' +
              'vec3 transformed = displaced;'
            )
          );
      };

      const mesh = new THREE.Mesh(geo, mat);
      const posAttr = geo.attributes['position'] as THREE.BufferAttribute;
      mesh.userData['basePositions'] = new Float32Array(posAttr.array as Float32Array);
      mesh.userData['halfWidth'] = width / 2;

      return { mesh, geo, mat };
    };

    // Rebuild plane geometry and update mesh when actual dimensions are known
    const updatePlaneWithTexture = (
      mesh: THREE.Mesh,
      mat: THREE.MeshBasicMaterial,
      oldGeo: THREE.PlaneGeometry,
      texture: THREE.Texture,
      actualWidth: number,
      isVideo: boolean,
      index: number
    ): THREE.PlaneGeometry => {
      // Dispose old placeholder texture
      if (mat.map && mat.map !== texture) {
        mat.map.dispose();
      }
      
      // Update material with actual texture
      mat.map = texture;
      mat.needsUpdate = true;
      this.textures[index] = texture;

      // Create new geometry with actual dimensions
      const newGeo = new THREE.PlaneGeometry(actualWidth, baseHeight, ...(isVideo ? [12, 8] : [300, 300]));
      mesh.geometry = newGeo;
      
      // Update mesh userData
      const posAttr = newGeo.attributes['position'] as THREE.BufferAttribute;
      mesh.userData['basePositions'] = new Float32Array(posAttr.array as Float32Array);
      mesh.userData['halfWidth'] = actualWidth / 2;

      // Dispose old geometry
      oldGeo.dispose();

      // Update geometry in array
      const geoIndex = this.geometries.indexOf(oldGeo);
      if (geoIndex !== -1) {
        this.geometries[geoIndex] = newGeo;
      }

      return newGeo;
    };

    // Recalculate positions after a plane's width changes, preserving scroll progress
    const recalculatePositions = () => {
      if (!this.group || !this.camera) return;
      
      // Capture current scroll progress before changing anything
      const scrollProgress = this.getScrollProgressPercent() / 100; // 0 to 1
      
      let currentX = 0;
      const children = this.group.children as THREE.Mesh[];
      
      for (const child of children) {
        const halfWidth = child.userData['halfWidth'] || defaultWidth / 2;
        child.position.x = currentX + halfWidth;
        currentX += halfWidth * 2 + this.HORIZONTAL_GAP;
      }

      const newTotalWidth = currentX - this.HORIZONTAL_GAP;
      this.totalWidth = newTotalWidth;

      // Restore scroll position based on progress
      const scale = this.group.scale.x || 1;
      const frustumHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const frustumWidth = frustumHeight * this.camera.aspect;
      const contentWidth = this.totalWidth * scale;
      
      if (contentWidth <= frustumWidth) {
        this.group.position.x = -contentWidth / 2;
      } else {
        const rightMarginWorld = frustumWidth * this.RIGHT_MARGIN_FRACTION;
        const minX = frustumWidth / 2 - contentWidth - rightMarginWorld;
        const maxX = -frustumWidth / 2 + this.getLeftMarginWorld(frustumWidth);
        // Restore position based on saved progress
        this.group.position.x = maxX - scrollProgress * (maxX - minX);
      }
      this.clampGroupX();
    };

    // First pass: create all placeholder planes immediately
    let currentX = 0;
    const planeData: { mesh: THREE.Mesh; geo: THREE.PlaneGeometry; mat: THREE.MeshBasicMaterial; media: Project['medias'][0] }[] = [];

    for (const media of medias) {
      const isVideo = media.type === 'video';
      const { mesh, geo, mat } = createPlaceholderPlane(defaultWidth, baseHeight, isVideo);
      
      mesh.position.x = currentX + defaultWidth / 2;
      currentX += defaultWidth + this.HORIZONTAL_GAP;

      this.group!.add(mesh);
      this.geometries.push(geo);
      this.materials.push(mat);
      this.textures.push(mat.map!); // Placeholder texture

      planeData.push({ mesh, geo, mat, media });
    }

    // Set initial total width and position
    this.totalWidth = currentX - this.HORIZONTAL_GAP;
    if (this.camera && this.group) {
      const scale = this.group.scale.x || 1;
      const frustumHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const frustumWidth = frustumHeight * this.camera.aspect;
      const contentWidth = this.totalWidth * scale;
      if (contentWidth <= frustumWidth) {
        this.group.position.x = -contentWidth / 2;
      } else {
        const maxX = -frustumWidth / 2 + this.getLeftMarginWorld(frustumWidth);
        this.group.position.x = maxX;
      }
    }
    this.clampGroupX();

    // Track pending recalculation to batch updates
    let recalculatePending = false;
    const scheduleRecalculate = () => {
      if (recalculatePending) return;
      recalculatePending = true;
      requestAnimationFrame(() => {
        recalculatePending = false;
        if (!this.sceneManager.destroyed) {
          recalculatePositions();
        }
      });
    };

    // Second pass: load textures asynchronously and update planes
    planeData.forEach(({ mesh, geo, mat, media }, index) => {
      // Track the current geometry for this plane (may change if updated)
      let currentGeo = geo;
      
      if (media.type === 'image') {
        loader.load(
          media.url,
          (tex) => {
            if (this.sceneManager.destroyed) return;
            tex.colorSpace = THREE.SRGBColorSpace;
            const aspect = tex.image.width / tex.image.height;
            const actualWidth = baseHeight * aspect;
            currentGeo = updatePlaneWithTexture(mesh, mat, currentGeo, tex, actualWidth, false, index);
            scheduleRecalculate();
          },
          undefined,
          () => {
            // On error, keep the red placeholder
            console.warn(`Failed to load image: ${media.url}`);
          }
        );
      } else if (media.type === 'video') {
        const video = document.createElement('video');
        video.src = media.url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
        
        video.addEventListener('loadedmetadata', () => {
          if (this.sceneManager.destroyed) return;
          
          // Wait 200ms before first play to avoid UI jank
          setTimeout(() => {
            if (this.sceneManager.destroyed) return;
            
            video.play().then(() => {
              if (this.sceneManager.destroyed) {
                video.pause();
                return;
              }
              
              const vtex = new THREE.VideoTexture(video);
              vtex.colorSpace = THREE.SRGBColorSpace;
              const vw = video.videoWidth;
              const vh = video.videoHeight;
              const aspect = vw / vh;
              const actualWidth = baseHeight * aspect;
              currentGeo = updatePlaneWithTexture(mesh, mat, currentGeo, vtex, actualWidth, true, index);
              scheduleRecalculate();
            }).catch(() => {
              console.warn(`Failed to play video: ${media.url}`);
            });
          }, 600);
        });

        video.addEventListener('error', () => {
          console.warn(`Failed to load video: ${media.url}`);
        });
      }
    });
  }
  
  private attachScroll(container: HTMLElement): void {
    const onWheel = (e: WheelEvent) => {
      if (!this.group || !this.renderer) return;

      // Only react if the pointer is within the carousel container bounds
      const rect = container.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (!inside) return;

      const canvasWidth = this.renderer.domElement.clientWidth || 1;
      const worldDelta = (-e.deltaY / canvasWidth) * this.WHEEL_SCROLL_SCALE;
      const applied = this.applyHorizontalDelta(worldDelta);

      // accumulate momentum with acceleration factor for more natural feel
      this.velocityX += applied * this.INPUT_ACCELERATION_FACTOR;
      // cap velocity to avoid runaway speeds
      if (this.velocityX > this.MAX_VELOCITY) this.velocityX = this.MAX_VELOCITY;
      if (this.velocityX < -this.MAX_VELOCITY) this.velocityX = -this.MAX_VELOCITY;

      // attempt to start any paused videos on user interaction
      for (const mat of this.materials) {
        const m = mat as any;
        const map = m && m.map;
        const vid: HTMLVideoElement | undefined = map && map.isVideoTexture ? map.image : undefined;
        if (vid && vid.paused) {
          try { vid.play(); } catch {}
        }
      }

      // When pinned at an edge, allow momentum to decay naturally in animate();
      // do not hard-reset velocity or distortion intensity here.
      try { e.preventDefault(); } catch {}
    };

    // Listen globally so overlays do not block wheel interaction; use capture to avoid stopPropagation
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });

    (container as any)._carouselCleanup = () => {
      window.removeEventListener('wheel', onWheel as any, true);
    };
  }

  private getContainerPixelWidth(): number {
    const canvasW = this.renderer && this.renderer.domElement && this.renderer.domElement.clientWidth;
    if (canvasW && canvasW > 0) return canvasW;
    if (this.containerEl) {
      const rect = this.containerEl.getBoundingClientRect();
      return Math.max(1, Math.floor(rect.width));
    }
    return Math.max(1, Math.floor((window && window.innerWidth) || 1));
  }

  private getLeftMarginWorld(frustumWidth: number): number {
    const pxWidth = this.getContainerPixelWidth();
    const fractionWorld = frustumWidth * this.LEFT_MARGIN_FRACTION;
    const minWorld = frustumWidth * (this.LEFT_MARGIN_MIN_PX / pxWidth);
    return Math.max(fractionWorld, minWorld);
  }

  public resize(): void {
    if (!this.renderer || !this.camera || !this.containerEl || this.sceneManager.destroyed) return;
    const rect = this.containerEl.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    // capture previous bounds relative position before applying new sizes
    const frustumHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const prevAspect = this.camera.aspect || (w / h);
    const prevFrustumWidth = frustumHeight * prevAspect;
    const prevContentWidth = this.totalWidth * (this.group ? (this.group.scale.x || 1) : 1);
    const prevFits = prevContentWidth <= prevFrustumWidth;
    let prevMinX = 0, prevMaxX = 0, prevAlpha = 1;
    if (!prevFits) {
      const rightMarginWorldPrev = prevFrustumWidth * this.RIGHT_MARGIN_FRACTION;
      prevMinX = prevFrustumWidth / 2 - prevContentWidth - rightMarginWorldPrev;
      prevMaxX = -prevFrustumWidth / 2 + this.getLeftMarginWorld(prevFrustumWidth);
      const beforeX = this.group ? this.group.position.x : 0;
      const denom = Math.max(1e-6, (prevMaxX - prevMinX));
      prevAlpha = Math.max(0, Math.min(1, (beforeX - prevMinX) / denom));
    }

    // apply new renderer size and camera aspect
    this.sceneManager.resizeRenderer(this.renderer, w, h, 1.6);
    this.sceneManager.resizePerspectiveCamera(this.camera, w, h);

    // maintain full-height images by scaling group uniformly to match new frustum height
    if (this.group && this.camera) {
      const newFrustumHeight = frustumHeight; // unchanged by aspect
      const targetHeight = newFrustumHeight * (1 - 2 * this.verticalPadding);
      const scaledTarget = targetHeight * this.planeScale;
      const currentScale = this.group.scale.y || 1;
      const currentVisibleHeight = this.baseHeight * currentScale;
      const scaleFactor = scaledTarget / currentVisibleHeight;
      this.group.scale.multiplyScalar(scaleFactor);
      this.baseHeight = scaledTarget;

      // recompute bounds and restore relative position
      const newFrustumWidth = newFrustumHeight * this.camera.aspect;
      const newContentWidth = this.totalWidth * (this.group.scale.x || 1);
      const newFits = newContentWidth <= newFrustumWidth;
      if (newFits) {
        this.group.position.x = -newContentWidth / 2;
      } else {
        const rightMarginWorld = newFrustumWidth * this.RIGHT_MARGIN_FRACTION;
        const minX = newFrustumWidth / 2 - newContentWidth - rightMarginWorld;
        const maxX = -newFrustumWidth / 2 + this.getLeftMarginWorld(newFrustumWidth);
        this.group.position.x = minX + prevAlpha * (maxX - minX);
      }
    }

    this.clampGroupX();
    this.emitProgressIfChanged(true);
  }

  private animate = (): void => {

    // apply velocity with clamping and compute actual movement this frame
    const applied = this.applyHorizontalDelta(this.velocityX);
    // always apply friction to momentum so edges don't hard-stop velocity
    this.velocityX *= 0.92;
    if (Math.abs(this.velocityX) < 0.0001) this.velocityX = 0;

    // Apply spring force to smoothly pull back from overscroll
    if (this.group && this.camera && this.renderer) {
      const scale = this.group.scale.x || 1;
      const frustumHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const frustumWidth = frustumHeight * this.camera.aspect;
      const contentWidth = this.totalWidth * scale;
      if (contentWidth > frustumWidth) {
        const rightMarginWorld = frustumWidth * this.RIGHT_MARGIN_FRACTION;
        const minX = frustumWidth / 2 - contentWidth - rightMarginWorld;
        const maxX = -frustumWidth / 2 + this.getLeftMarginWorld(frustumWidth);
        const x = this.group.position.x;
        
        // Spring back from overscroll with smooth easing
        if (x < minX) {
          const overAmount = minX - x;
          const springForce = overAmount * this.SPRING_STIFFNESS;
          this.group.position.x += springForce;
          // Dampen velocity more when overscrolled
          this.velocityX *= 0.85;
          // Snap to boundary when close enough
          if (Math.abs(this.group.position.x - minX) < 0.001) {
            this.group.position.x = minX;
          }
        } else if (x > maxX) {
          const overAmount = x - maxX;
          const springForce = overAmount * this.SPRING_STIFFNESS;
          this.group.position.x -= springForce;
          // Dampen velocity more when overscrolled
          this.velocityX *= 0.85;
          // Snap to boundary when close enough
          if (Math.abs(this.group.position.x - maxX) < 0.001) {
            this.group.position.x = maxX;
          }
        }
        
        // Extra velocity damping when approaching edges (not overscrolled yet)
        const eps = 0.05;
        if (x <= minX + eps && this.velocityX < 0) this.velocityX *= 0.7;
        if (x >= maxX - eps && this.velocityX > 0) this.velocityX *= 0.7;
      }
    }

    // update distortion intensity relative to current scroll speed
    const speed = Math.abs(applied);
    if (speed === 0) {
      this.distortionIntensity = 0;
    } else {
      const targetIntensity = Math.min(1, speed / this.MAX_SPEED_FOR_FULL_DISTORTION);
      this.distortionIntensity += (targetIntensity - this.distortionIntensity) * 0.15; // ease
      if (this.distortionIntensity < 0.0005) this.distortionIntensity = 0;
    }

    // progressive lens-like distortion moved to GPU via shader uniforms
    if (this.group && this.camera && this.scene) {
      this.scene.updateMatrixWorld(true);
      const radius = .9;
      const xScale = 1.5;
      const yScale = 3.6;
      const maxZ = this.baseHeight * this.DISTORTION_STRENGTH * this.distortionIntensity;

      // update shader uniforms instead of mutating geometry on CPU
      for (const mat of this.materials) {
        const m = mat as any;
        const ud = (m && m.userData) || {};
        if (ud.uLensRadiusUniform) ud.uLensRadiusUniform.value = radius;
        if (ud.uLensXScaleUniform) ud.uLensXScaleUniform.value = xScale;
        if (ud.uLensYScaleUniform) ud.uLensYScaleUniform.value = yScale;
        if (ud.uLensMaxZUniform) ud.uLensMaxZUniform.value = maxZ;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.emitProgressIfChanged();
  };

  private applyHorizontalDelta(delta: number, allowOverscroll = true): number {
    if (!this.group) return 0;
    const before = this.group.position.x;
    // compute bounds
    const scale = this.group.scale.x || 1;
    const frustumHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const frustumWidth = frustumHeight * this.camera.aspect;
    const contentWidth = this.totalWidth * scale;
    if (contentWidth <= frustumWidth) {
      this.group.position.x = -contentWidth / 2;
      return 0;
    }
    const rightMarginWorld = frustumWidth * this.RIGHT_MARGIN_FRACTION;
    const minX = frustumWidth / 2 - contentWidth - rightMarginWorld;
    const maxX = -frustumWidth / 2 + this.getLeftMarginWorld(frustumWidth);
    const softZone = frustumWidth * this.EDGE_SOFT_ZONE;
    const maxOverscroll = frustumWidth * this.OVERSCROLL_MAX;

    // Calculate progressive resistance based on position relative to edges
    let resistanceFactor = 1.0;
    
    if (allowOverscroll) {
      // Scrolling left (delta < 0) towards min edge
      if (delta < 0) {
        if (before <= minX) {
          // Already past the edge - heavy resistance with exponential decay
          const overAmount = minX - before;
          const overRatio = Math.min(overAmount / maxOverscroll, 1);
          resistanceFactor = this.OVERSCROLL_DAMPING * (1 - overRatio * 0.8);
        } else if (before < minX + softZone) {
          // In soft zone - gradually increase resistance as we approach edge
          const distToEdge = before - minX;
          const t = distToEdge / softZone; // 0 at edge, 1 at soft zone start
          // Smooth easing: starts at 1, decreases to ~0.3 at edge
          resistanceFactor = 0.3 + 0.7 * (t * t * (3 - 2 * t));
        }
      }
      
      // Scrolling right (delta > 0) towards max edge
      if (delta > 0) {
        if (before >= maxX) {
          // Already past the edge - heavy resistance with exponential decay
          const overAmount = before - maxX;
          const overRatio = Math.min(overAmount / maxOverscroll, 1);
          resistanceFactor = this.OVERSCROLL_DAMPING * (1 - overRatio * 0.8);
        } else if (before > maxX - softZone) {
          // In soft zone - gradually increase resistance as we approach edge
          const distToEdge = maxX - before;
          const t = distToEdge / softZone; // 0 at edge, 1 at soft zone start
          // Smooth easing: starts at 1, decreases to ~0.3 at edge
          resistanceFactor = 0.3 + 0.7 * (t * t * (3 - 2 * t));
        }
      }
    }

    let target = before + delta * resistanceFactor;
    
    // Hard cap on maximum overscroll
    if (allowOverscroll) {
      if (target < minX - maxOverscroll) target = minX - maxOverscroll;
      if (target > maxX + maxOverscroll) target = maxX + maxOverscroll;
    } else {
      if (target < minX) target = minX;
      if (target > maxX) target = maxX;
    }

    const applied = target - before;
    this.group.position.x = target;
    return applied;
  }

  private clampGroupX(): void {
    if (!this.group || !this.camera) return;
    const scale = this.group.scale.x || 1;
    const frustumHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const frustumWidth = frustumHeight * this.camera.aspect;
    const contentWidth = this.totalWidth * scale;

    if (contentWidth <= frustumWidth) {
      // center content; no scrolling
      this.group.position.x = -contentWidth / 2;
      this.velocityX = 0;
      return;
    }

    const rightMarginWorld = frustumWidth * this.RIGHT_MARGIN_FRACTION;
    const minX = frustumWidth / 2 - contentWidth - rightMarginWorld; // content right edge at viewport right minus margin
    const maxX = -frustumWidth / 2 + this.getLeftMarginWorld(frustumWidth); // left margin reserved (min px applied)
    if (this.group.position.x < minX) this.group.position.x = minX;
    if (this.group.position.x > maxX) this.group.position.x = maxX;
  }

  public destroy(): void {
    this.sceneManager.destroy();

    // remove scroll listeners
    if (this.containerEl && (this.containerEl as any)._carouselCleanup) {
      try { (this.containerEl as any)._carouselCleanup(); } catch {}
      (this.containerEl as any)._carouselCleanup = undefined;
    }

    // pause any playing videos
    for (const mat of this.materials) {
      const m = mat as any;
      const map = m && m.map;
      const vid: HTMLVideoElement | undefined = map && map.isVideoTexture ? map.image : undefined;
      if (vid && !vid.paused) {
        try { vid.pause(); } catch {}
      }
    }

    // dispose GPU resources
    try { this.textures.forEach(t => t.dispose()); } catch {}
    try { this.materials.forEach(m => m.dispose()); } catch {}
    try { this.geometries.forEach(g => g.dispose()); } catch {}
    this.textures = [];
    this.materials = [];
    this.geometries = [];

    // remove group from scene
    if (this.group) {
      try { this.scene.remove(this.group); } catch {}
      this.group = null;
    }

    // remove canvas from DOM and dispose renderer
    this.sceneManager.disposeRenderer(this.renderer, this.containerEl);

    this.velocityX = 0;
    this.distortionIntensity = 0;
    this.onProgress = undefined;
    this.lastProgress = null;
  }

  private emitProgressIfChanged(force = false): void {
    if (!this.onProgress) return;
    const percent = this.getScrollProgressPercent();
    if (force || this.lastProgress === null || Math.abs(percent - this.lastProgress) >= 0.001) {
      this.lastProgress = percent;
      try { this.onProgress(percent); } catch {}
    }
  }

  public getScrollProgressPercent(): number {
    if (!this.group || !this.camera || !this.renderer) return 0;
    const scale = this.group.scale.x || 1;
    const frustumHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const frustumWidth = frustumHeight * this.camera.aspect;
    const contentWidth = this.totalWidth * scale;
    if (contentWidth <= frustumWidth) return 0;
    const rightMarginWorld = frustumWidth * this.RIGHT_MARGIN_FRACTION;
    const minX = frustumWidth / 2 - contentWidth - rightMarginWorld;
    const maxX = -frustumWidth / 2 + this.getLeftMarginWorld(frustumWidth);
    const x = this.group.position.x;
    const t = (maxX - x) / (maxX - minX);
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * 100;
  }
}