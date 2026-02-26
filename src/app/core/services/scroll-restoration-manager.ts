import { effect, inject, Injectable } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ScrollManager } from './scroll-manager';
import { NavigationLoaderManager } from './navigation-loader-manager';
import { SavedScrollPosition } from '../../shared/models/saved-scroll-position.interface';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Saves and restores scroll position across navigation.
 * Used when returning to a previous page (e.g., back from project detail).
 */
@Injectable({ providedIn: 'root' })
export class ScrollRestorationManager {
  public savedPosition: SavedScrollPosition | null = null;
  private currentUrl = '';

  private readonly router = inject(Router);
  private readonly scrollManager = inject(ScrollManager);
  private readonly navigationLoader = inject(NavigationLoaderManager);
  private readonly viewportScroller = inject(ViewportScroller);

  private navigationsSinceSave: number = 0;

  constructor() {
    this.trackNavigation();

    this.setupLoadingEffect();
  }

  /** Tracks navigation events and clears stale saved positions. */
  private trackNavigation(): void {
    this.router.events
    .pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed()
    )
    .subscribe((event) => {
      this.currentUrl = this.normalizeUrl(event.urlAfterRedirects || event.url);
      
      if (this.navigationsSinceSave > 1 && this.savedPosition) {
        this.clearSavedPosition();
      }
      
      if (this.savedPosition) {
        this.navigationsSinceSave++;
      }
    });
  }

  /** Restores scroll position when page finishes loading. */
  private setupLoadingEffect(): void {
    effect(() => {
      if (!this.navigationLoader.isLoading() && this.savedPosition?.url === this.currentUrl) {
        this.restoreScrollPosition();
      }
    });
  }

  /** 
   * Saves current scroll position for later restoration. 
   */
  public saveCurrentPosition(): void {
    this.savedPosition = { url: this.currentUrl, scrollY: this.scrollManager.actualScroll() };
  }

  /** 
   * Scrolls to the saved position and clears it. 
   */
  private restoreScrollPosition(): void {
    if (!this.savedPosition) return;
    this.viewportScroller.scrollToPosition([0, this.savedPosition.scrollY]);
    this.clearSavedPosition();
  }

  /** 
   * Resets saved position and navigation counter. 
   */
  private clearSavedPosition(): void {
    this.navigationsSinceSave = 0;
    this.savedPosition = null;
  }

  /** 
   * Strips query params and hash from URL for comparison. 
   */
  private normalizeUrl(url: string): string {
    return url.split('?')[0].split('#')[0];
  }
}