import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, OnDestroy, input, model, effect } from '@angular/core';

@Component({
  selector: 'app-status-pill',
  imports: [],
  templateUrl: './status-pill.html',
  styleUrl: './status-pill.scss',
})
export class StatusPill implements OnDestroy {
  public isPresenting = model<boolean>(false);
  public type = input.required<'error' | 'success'>();
  public autoHide = input<boolean>(false);
  public autoHideDelay = input<number>(3000);

  private autoHideTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      if(this.isPresenting() && this.autoHide()) {
        this.startAutoHideTimer();
      }
      else if(!this.isPresenting()) {
        this.clearAutoHideTimer();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearAutoHideTimer();
  }

  private startAutoHideTimer(): void {
    this.clearAutoHideTimer();
    this.autoHideTimer = setTimeout(() => {
      this.close();
    }, this.autoHideDelay());
  }

  private clearAutoHideTimer(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = undefined;
    }
  }

  public close(): void {
    this.clearAutoHideTimer();
    this.isPresenting.set(false);
  }
}
