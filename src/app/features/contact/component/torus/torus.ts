import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, NgZone, OnDestroy, OnInit, output, ViewChild } from '@angular/core';
import { TorusEngine } from './services/torus-engine';
import { TorusText } from './services/torus-text';

@Component({
  selector: 'app-torus',
  imports: [],
  templateUrl: './torus.html',
  styleUrl: './torus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TorusEngine, TorusText],
})
export class Torus implements OnInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  
  public loadingProgress = output<number>();
  
  private readonly TORUS_TEXT = "THIS IS A VERY COOL EFFECT!";
  private readonly CENTER_TEXT = "LET'S GET IN TOUCH";
  private readonly CUSTOM_FONT_PATH = './fonts/gothic.ttf';

  isVisible = false;

  private ngZone = inject(NgZone);
  private engine = inject(TorusEngine);
  private textManager = inject(TorusText);

  private onPointerMoveBound = (ev: PointerEvent) => {
    this.engine.onPointerMove(ev, this.containerRef.nativeElement);
  };
  private onPointerLeaveBound = () => {
    this.engine.onPointerLeave();
  };
  private onPointerDownBound = (ev: PointerEvent) => {
    const container = this.containerRef?.nativeElement;
    if (container && this.engine.isPointerOnTorus(ev, container)) {
      this.textManager.cycleTextColor();
    }
  };

  async ngOnInit() {
    // Attach pointer listeners outside Angular to avoid change-detection churn on high-frequency events.
    const el = this.containerRef?.nativeElement;
    if (el) {
      this.ngZone.runOutsideAngular(() => {
        el.addEventListener('pointermove', this.onPointerMoveBound, { passive: true });
        el.addEventListener('pointerleave', this.onPointerLeaveBound, { passive: true });
        el.addEventListener('pointerdown', this.onPointerDownBound, { passive: true });
      });
    }

    // Track loading progress
    let totalProgress = 0;
    let loadingComplete = false;
    const updateProgress = (progress: number) => {
      totalProgress = Math.min(100, Math.max(0, progress));
      this.ngZone.run(() => {
        this.loadingProgress.emit(totalProgress);
      });
      
      // When loading reaches 100%, wait 500ms then enable intro animation
      if (totalProgress >= 100 && !loadingComplete) {
        loadingComplete = true;
        setTimeout(() => {
          this.engine.enableIntroAnimation();
        }, 1000);
      }
    };

    const resp = await this.textManager.init(
      this.CUSTOM_FONT_PATH, 
      this.TORUS_TEXT, 
      this.CENTER_TEXT,
      (progress: number) => updateProgress(progress * 0.5) // Font/text loading is 50% of total
    );
    
    this.engine.init(
      this.containerRef.nativeElement, 
      resp,
      (progress: number) => updateProgress(50 + progress * 0.5) // Engine loading is remaining 50%
    );

    // Start rendering loop immediately, but intro animation will be delayed
    this.ngZone.runOutsideAngular(() => this.engine.start());

    // Trigger fade-in once initialized
    setTimeout(() => {
      this.isVisible = true;
    });
  }

  ngOnDestroy(): void {
    const el = this.containerRef?.nativeElement;
    if (el) {
      el.removeEventListener('pointermove', this.onPointerMoveBound as any);
      el.removeEventListener('pointerleave', this.onPointerLeaveBound as any);
      el.removeEventListener('pointerdown', this.onPointerDownBound as any);
    }
    this.engine.dispose(this.containerRef?.nativeElement);
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.engine.resize();
  }
}