import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollManager } from '../../../../core/services/scroll-manager';
import { ScrollSpringConfig } from '../../../models/scroll-spring-config.interface';

/**
 * Manages spring-physics based scroll interactions at scroll boundaries.
 * Provides elastic overscroll behavior with navigation trigger capability.
 */
@Injectable()
export class ScrollSpringManager {
  private scrollManager = inject(ScrollManager);
  private router = inject(Router);

  readonly scrollPercentage = signal(0);

  private readonly POSITION_THRESHOLD = 0.01;
  private readonly VELOCITY_THRESHOLD = 0.01;
  private readonly DECAY_RATE = 0.9;
  private readonly NAVIGATION_DELAY = 300;

  private navTimeout: any;
  private listening: boolean = false;
  private velocity = 0;
  private position = 0;
  private rafId: number | null = null;
  private lastWheel = 0;
  private locked = false;
  private config = {
    maxScrollDistance: 0,
    stiffness: 0.05,
    damping: 0.85, mass: 1,
    wheelTimeout: 150,
    wheelSensitivity: 0.1,
    minPercentage: 0.05,
    routeUrl: ''
  };

  /**
   * Initializes the spring manager with configuration options.
   * @param cfg Optional configuration overrides for spring behavior
   */
  public init(cfg?: ScrollSpringConfig) {
    Object.assign(this.config, cfg);
    this.config.maxScrollDistance ||= innerHeight * 0.5;
  }

  /**
   * Handles wheel events to apply spring physics at scroll limits.
   */
  private onWheel = (e: WheelEvent) => {
    const limit = this.scrollManager.limit();
    if (this.locked || limit <= 0 || this.scrollManager.actualScroll() < limit) return;
    e.preventDefault();
    this.lastWheel = performance.now();
    const d = e.deltaY * this.config.wheelSensitivity;
    this.velocity += d;
    this.position = Math.max(0, Math.min(this.config.maxScrollDistance, this.position + d));
    if (this.position >= this.config.maxScrollDistance) { this.lock(); return; }
    this.setPct();
    this.rafId ??= requestAnimationFrame(this.tick);
  };

  /**
   * Resets all internal state to initial values.
   */
  private resetState(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.position = 0;
    this.velocity = 0;
    this.locked = false;
    this.scrollPercentage.set(0);
    this.listening = false;
    if (this.navTimeout) clearTimeout(this.navTimeout);
  }

  /**
   * Starts listening for wheel events to enable spring behavior.
   */
  public start() {
    if (this.listening) return;

    addEventListener('wheel', this.onWheel, { passive: false });
    this.listening = true;
  }

  /**
   * Stops the spring manager and removes event listeners.
   */
  public stop(): void {
    this.resetState();
    removeEventListener('wheel', this.onWheel);
  }

  /**
   * Resets spring state without removing event listeners.
   */
  public reset(): void {
    this.resetState();
  }

  /**
   * Locks the spring at maximum position and triggers navigation.
   */
  private lock() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.locked = true;
    this.scrollManager.stop();
    this.position = this.config.maxScrollDistance;
    this.velocity = 0;
    this.scrollPercentage.set(100);

    this.navTimeout = setTimeout(() => {
      this.router.navigateByUrl(this.config.routeUrl)
    }, this.NAVIGATION_DELAY);
  }

  /**
   * Updates the scroll percentage signal based on current position.
   */
  private setPct() {
    const r = (this.position / this.config.maxScrollDistance) * 100;
    this.scrollPercentage.set(r < this.POSITION_THRESHOLD ? this.config.minPercentage : Math.min(100, Math.max(this.config.minPercentage, r)));
  }

  /**
   * Animation frame callback that applies spring physics calculations.
   * Handles velocity, damping, and position updates each frame.
   */
  private tick = () => {
    if (this.locked) return;
    const limit = this.scrollManager.limit();
    const atLimit = limit > 0 && this.scrollManager.actualScroll() >= limit;
    const active = performance.now() - this.lastWheel < this.config.wheelTimeout;

    if (atLimit && (this.position > this.VELOCITY_THRESHOLD || active)) {
      const s = active ? 0.1 : 1;
      this.velocity += (-this.config.stiffness * this.position * s - this.config.damping * this.velocity * s) / this.config.mass;
      this.position = Math.max(0, Math.min(this.config.maxScrollDistance, this.position + this.velocity));
      if (this.position >= this.config.maxScrollDistance) { this.lock(); return; }
      if (this.position <= 0.01 && Math.abs(this.velocity) < 0.01) { this.position = this.velocity = 0; this.scrollPercentage.set(0); }
      else this.setPct();
    } else if (this.position > 0.01) {
      this.position *= this.DECAY_RATE;
      this.setPct();
    } else {
      this.position = this.velocity = 0;
      this.scrollPercentage.set(0);
      this.rafId = null;
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };
}