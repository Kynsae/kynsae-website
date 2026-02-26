import { 
  WebGLRenderer, 
  Points, 
  OrthographicCamera, 
  Scene, 
  Mesh, 
  LineSegments, 
  PerspectiveCamera 
} from 'three';

/**
 * Shared utility for managing Three.js scene lifecycle with optimized resize handling
 * and proper resource cleanup. Use this to harmonize resize and destroy patterns.
 */
export class ThreeSceneManager {
  private resizeScheduled = false;
  private resizeCallback?: () => void;
  private rafId: number | null = null;
  private isDestroyed = false;

  /**
   * Standardized resize handler with requestAnimationFrame debouncing
   * Call this from @HostListener('window:resize')
   */
  public handleResize(callback: () => void): void {
    if (this.isDestroyed) return;
    
    if (this.resizeScheduled) return;
    this.resizeScheduled = true;
    this.resizeCallback = callback;
    
    requestAnimationFrame(() => {
      if (this.isDestroyed) return;
      this.resizeScheduled = false;
      if (this.resizeCallback) {
        this.resizeCallback();
      }
    });
  }

  /**
   * Standardized animation loop wrapper
   * Ensures animation stops when destroyed
   */
  public startAnimation(animateFn: () => void): void {
    if (this.rafId || this.isDestroyed) return;
    
    const loop = () => {
      if (this.isDestroyed) return;
      animateFn();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Stop animation loop
   */
  public stopAnimation(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Standardized renderer disposal with DOM cleanup
   */
  public disposeRenderer(renderer: WebGLRenderer, container?: HTMLElement): void {
    if (!renderer) return;
    
    // Remove canvas from DOM first
    const canvas = renderer.domElement;
    if (canvas && canvas.parentNode) {
      try {
        canvas.parentNode.removeChild(canvas);
      } catch (e) {
        // Element may already be removed
      }
    } else if (container && canvas && container.contains(canvas)) {
      try {
        container.removeChild(canvas);
      } catch (e) {
        // Element may already be removed
      }
    }
    
    // Dispose renderer resources
    try {
      renderer.dispose();
    } catch (e) {
      // Renderer may already be disposed
    }
  }

  /**
   * Standardized scene cleanup - disposes all geometries and materials
   */
  public disposeScene(scene: Scene): void {
    if (!scene) return;
    
    scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points || object instanceof LineSegments) {
        try {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => {
                try {
                  mat.dispose();
                } catch (e) {
                  // Material may already be disposed
                }
              });
            } else {
              try {
                object.material.dispose();
              } catch (e) {
                // Material may already be disposed
              }
            }
          }
        } catch (e) {
          // Object may already be disposed
        }
      }
    });
    
    try {
      scene.clear();
    } catch (e) {
      // Scene may already be cleared
    }
  }

  /**
   * Standardized camera resize for PerspectiveCamera
   */
  public resizePerspectiveCamera(
    camera: PerspectiveCamera,
    width: number,
    height: number
  ): void {
    if (!camera || this.isDestroyed) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /**
   * Standardized camera resize for OrthographicCamera
   */
  public resizeOrthographicCamera(
    camera: OrthographicCamera,
    width: number,
    height: number,
    scale: number = 2
  ): void {
    if (!camera || this.isDestroyed) return;
    const aspect = width / height;
    camera.left = -scale * aspect;
    camera.right = scale * aspect;
    camera.top = scale;
    camera.bottom = -scale;
    camera.updateProjectionMatrix();
  }

  /**
   * Standardized renderer resize with optimized pixel ratio
   * @param maxPixelRatio - Maximum pixel ratio to cap (default: 1.5 for performance)
   */
  public resizeRenderer(
    renderer: WebGLRenderer,
    width: number,
    height: number,
    maxPixelRatio: number = 1.5
  ): void {
    if (!renderer || this.isDestroyed) return;
    renderer.setPixelRatio(Math.min(maxPixelRatio, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
  }

  /**
   * Complete cleanup - call this in ngOnDestroy
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.stopAnimation();
    this.resizeCallback = undefined;
  }

  /**
   * Check if manager is destroyed
   */
  public get destroyed(): boolean {
    return this.isDestroyed;
  }
}