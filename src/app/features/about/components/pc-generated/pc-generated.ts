import { ChangeDetectionStrategy, Component, effect, ElementRef, HostListener, inject, input, OnDestroy, OnInit, output, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { PCGeneratedManager } from './services/pc-generated-manager';
import { ThreeSceneManager } from '../../../../core/services/three-scene-manager';
import { NavigationLoaderManager } from '../../../../core/services/navigation-loader-manager';

@Component({
  selector: 'app-pc-generated',
  templateUrl: './pc-generated.html',
  styleUrl: './pc-generated.scss',
  providers: [PCGeneratedManager],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PCGenerated implements OnInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef;

  public percentage = input<number>(0);
  public loadProgress = output<number>();

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  private renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    powerPreference: 'low-power'
  });
  private sceneManager = new ThreeSceneManager();

  private pcGeneratedManager = inject(PCGeneratedManager);
  private navigationLoader = inject(NavigationLoaderManager);
  private explosionArmed = false;

  constructor() {
    effect(() => {
      this.pcGeneratedManager.setMorph(this.percentage());
    });

    // Arm the intro explosion only once the page is actually loaded (loader overlay gone).
    effect(() => {
      if (this.explosionArmed) return;
      if (this.navigationLoader.loadingPercentage() < 100) return;

      this.explosionArmed = true;
      
      setTimeout(() => {
        this.pcGeneratedManager.armExplosion();
      }, 900);
    });
  }

  async ngOnInit(): Promise<void> {
    this.initScene();
    // Start rendering immediately so the UI stays responsive while data loads in workers
    this.sceneManager.startAnimation(this.animate);
    await this.pcGeneratedManager.loadShadersAndCreateMaterial(this.scene, (progress) => {
      this.loadProgress.emit(progress);
    });
  }

  private initScene(): void {
    this.sceneManager.resizeRenderer(this.renderer, window.innerWidth, window.innerHeight, 1.2);
    this.renderer.setClearColor(0x000000, 0);
    this.containerRef.nativeElement.appendChild(this.renderer.domElement);
  }

  private animate = (): void => {
    this.pcGeneratedManager.update(this.camera, this.renderer);
    this.renderer.render(this.scene, this.camera);
  }

  @HostListener('window:resize')
  public onResize(): void {
    this.sceneManager.handleResize(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.sceneManager.resizePerspectiveCamera(this.camera, w, h);
      this.sceneManager.resizeRenderer(this.renderer, w, h, 1.2);
    });
  }

  @HostListener('window:mousemove', ['$event'])
  public onMouseMove(event: MouseEvent): void {
    this.pcGeneratedManager.onMouseMove(event.clientX, event.clientY);
  }

  ngOnDestroy(): void {
    this.pcGeneratedManager.destroy();
    this.sceneManager.destroy();
    this.sceneManager.disposeScene(this.scene);
    this.sceneManager.disposeRenderer(this.renderer, this.containerRef?.nativeElement);
  }
}