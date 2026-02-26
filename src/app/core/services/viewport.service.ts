import { Injectable, signal } from '@angular/core';

export const DEFAULT_MOBILE_BREAKPOINT = 850;

/**
 * Tracks viewport dimensions and device type (mobile vs desktop).
 * Initialized in App; dimensions are updated on window resize.
 */
@Injectable({
  providedIn: 'root'
})
export class ViewportService {
  /** Current viewport width in pixels. */
  public readonly width = signal(0);
  /** Current viewport height in pixels. */
  public readonly height = signal(0);
  /** True when viewport width is at or below the mobile breakpoint. */
  public readonly isMobile = signal(false);

  private readonly mobileBreakpoint: number;

  constructor() {
    this.mobileBreakpoint = DEFAULT_MOBILE_BREAKPOINT;
  }

  /**
   * Sets initial viewport dimensions. Call once from App on bootstrap.
   */
  public init(): void {
    this.updateDimensions();
  }

  /**
   * Reads window size and updates width, height, and isMobile.
   * Called from App on window:resize.
   */
  public updateDimensions(): void {
    if (typeof window === 'undefined') return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width.set(w);
    this.height.set(h);
    this.isMobile.set(w <= this.mobileBreakpoint);
  }
}
