import { inject, Injectable, signal } from '@angular/core';
import Lenis from 'lenis';
import { ViewportService } from './viewport.service';

/**
 * Manages scroll position: Lenis on desktop, native scroll events on mobile.
 * Provides reactive actualScroll and limit.
 */
@Injectable({
  providedIn: 'root'
})
export class ScrollManager {
  private readonly viewportService = inject(ViewportService);
  private lenis: Lenis | null = null;
  public readonly actualScroll = signal(0);
  public readonly limit = signal(0);

  /** 
   * Initializes scroll: Lenis on desktop, native scroll listener on mobile. 
   */
  public init(): void {
    if (this.viewportService.isMobile()) {
      this.initNativeScroll();
      return;
    }
    
    this.lenis = new Lenis({
      autoRaf: true,
      lerp: .1,
      duration: 0.4,
    });

    this.lenis.on('scroll', () => {
      this.actualScroll.set(this.lenis!.animatedScroll);
      this.limit.set(this.lenis!.limit);
    });
  }

  private initNativeScroll(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('native-scroll');
    }
    const update = (): void => {
      if (typeof window === 'undefined') return;
      this.actualScroll.set(window.scrollY);
      this.limit.set(
        document.documentElement.scrollHeight - window.innerHeight
      );
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /** 
   * Pauses smooth scrolling (e.g., during page transitions). No-op on mobile. 
   */
  public stop(): void {
    this.lenis?.stop();
  }

  /** 
   * Resumes smooth scrolling after being stopped. No-op on mobile. 
   */
  public start(): void {
    this.lenis?.start();
  }
}