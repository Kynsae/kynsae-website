import { Component, inject, effect, ElementRef, ChangeDetectionStrategy, viewChild } from '@angular/core';
import { ScrollManager } from '../../../core/services/scroll-manager';

const HANDLE_HEIGHT_VH = 10;
const HIDE_DELAY_MS = 300;

@Component({
  selector: 'app-scrollbar',
  templateUrl: './scrollbar.html',
  styleUrl: './scrollbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Scrollbar {
  private readonly scrollManager = inject(ScrollManager);
  private readonly containerRef = viewChild<ElementRef<HTMLElement>>('container');
  private readonly handleRef = viewChild<ElementRef<HTMLElement>>('handle');
  private hideTimeout = 0;
  private visible = false;

  constructor() {
    effect(() => {
      const container = this.containerRef()?.nativeElement;
      const handle = this.handleRef()?.nativeElement;
      if (!container || !handle) return;

      const scroll = this.scrollManager.actualScroll();
      const limit = this.scrollManager.limit();

      const progress = limit > 0 ? Math.min(1, Math.max(0, scroll / limit)) : 0;
      const topVh = progress * (100 - HANDLE_HEIGHT_VH);

      handle.style.transform = `translate3d(0,${topVh}vh,0)`;

      if (!this.visible) {
        this.visible = true;
        container.classList.add('visible');
      }

      clearTimeout(this.hideTimeout);
      this.hideTimeout = window.setTimeout(() => {
        this.visible = false;
        container.classList.remove('visible');
      }, HIDE_DELAY_MS);
    });
  }
}
