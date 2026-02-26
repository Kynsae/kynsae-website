import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { EasingType } from '../../shared/models/easing.type';

/**
 * Provides scroll-based interpolation and animation utilities.
 */
@Injectable({ providedIn: 'root' })
export class Parallax implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private viewportHeight = signal(0);
  private resizeListener = () => this.viewportHeight.set(window.innerHeight);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.viewportHeight.set(window.innerHeight);
      window.addEventListener('resize', this.resizeListener);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
  }

  /**
   * Calculates staggered transition delay for indexed elements.
   * @param index Element index in sequence
   * @param baseDelayInSeconds Initial delay before stagger starts
   * @param diff Delay increment per index
   */
  public getTransitionDelay(index: number, baseDelayInSecond: number = 0.0, diff: number = 0.15): string {
    return `${ baseDelayInSecond + index * diff }s`;
  }

  /**
   * Interpolates a value based on scroll position within a page range.
   * @param rangeStart Output value at scroll start
   * @param rangeEnd Output value at scroll end
   * @param pageStart Start page (1-based, viewport units)
   * @param pageEnd End page (viewport units)
   * @param currentScrollY Current scroll position in pixels
   * @param easing Easing function to apply
   */
  public lerp(
    rangeStart: number,
    rangeEnd: number,
    pageStart: number,
    pageEnd: number,
    currentScrollY: number,
    easing: EasingType = 'linear',
  ): number {
    const startY = this.viewportHeight() * (pageStart - 1);
    const endY = this.viewportHeight() * pageEnd;

    let t = (Math.max(startY, Math.min(currentScrollY, endY)) - startY) / (endY - startY);
    t = Math.max(0, Math.min(1, t));
    t = this.easingFunctions[easing](t);

    return rangeStart + t * (rangeEnd - rangeStart);
  }

  /** 
   * Easing function implementations for interpolation. 
   */
  private readonly easingFunctions: Record<EasingType, (t: number) => number> = {
    'linear': (t) => t,
    'ease-in': (t) => t * t * t,
    'ease-out': (t) => 1 - Math.pow(1 - t, 3),
    'ease-in-out': (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  };
}