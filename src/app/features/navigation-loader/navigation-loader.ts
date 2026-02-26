import { Component, inject, ChangeDetectionStrategy, computed, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { NavigationLoaderManager } from '../../core/services/navigation-loader-manager';

// Half circumference for each arc (π * r where r = 62.5) - constant outside class
const HALF_CIRCUMFERENCE = 196.34954084936207;
// Minimum time for initial logo-bar animation to complete (right bar: 0.4s delay + 0.7s duration + buffer)
const MIN_INITIAL_ANIMATION_MS = 500;

@Component({
  selector: 'app-navigation-loader',
  templateUrl: './navigation-loader.html',
  styleUrl: './navigation-loader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.hide]': 'isHidden()',
    '[class.complete]': 'isComplete()',
    '[style.--dash-offset]': 'strokeDashoffset()',
    '[class.arc-visible]': 'arcVisible()'
  }
})
export class NavigationLoader implements OnInit, OnDestroy {
  private readonly loader = inject(NavigationLoaderManager);
  
  // Track whether initial animation has completed
  private readonly initialAnimationDone = signal(false);
  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Single computed per unique reactive dependency - avoids duplicate signal reads
  protected readonly isHidden = computed(() => !this.loader.isLoading());
  // Complete only when both percentage is 100% AND initial animation has finished
  protected readonly isComplete = computed(() => 
    this.loader.loadingPercentage() >= 100 && this.initialAnimationDone()
  );
  protected readonly arcVisible = computed(() => this.loader.loadingPercentage() >= 1);
  
  protected readonly strokeDashoffset = computed(() => {
    const pct = this.loader.loadingPercentage();
    return pct >= 100 ? 0 : HALF_CIRCUMFERENCE * (1 - pct / 100);
  });

  constructor() {
    // Reset animation timer when loading starts
    effect(() => {
      if (this.loader.isLoading()) {
        this.initialAnimationDone.set(false);
        if (this.animationTimer) clearTimeout(this.animationTimer);
        this.animationTimer = setTimeout(() => {
          this.initialAnimationDone.set(true);
        }, MIN_INITIAL_ANIMATION_MS);
      }
    });
  }

  ngOnInit(): void {
    // Start initial animation timer on first load
    this.animationTimer = setTimeout(() => {
      this.initialAnimationDone.set(true);
    }, MIN_INITIAL_ANIMATION_MS);
  }

  ngOnDestroy(): void {
    if (this.animationTimer) clearTimeout(this.animationTimer);
  }
}