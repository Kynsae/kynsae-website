import { Injectable, signal } from '@angular/core';

@Injectable()
export class ProjectInfoUIManager {
  public progressPercent = signal(0);

  private readonly START_ANIMATION_PERCENT = 0.0;
  private readonly STOP_ANIMATION_PERCENT = 10;

  public onProgressPercent(progress: number): void {
    this.progressPercent.set(progress);
  }

  interpolate(
    startValue: number,
    endValue: number,
    stopPercent: number = this.STOP_ANIMATION_PERCENT
  ): number {
    const percent = this.progressPercent();

    if (percent <= this.START_ANIMATION_PERCENT) return startValue;
    if (percent >= stopPercent) return endValue;
    const t = (percent - this.START_ANIMATION_PERCENT) / (stopPercent - this.START_ANIMATION_PERCENT);
    return startValue + t * (endValue - startValue);
  }
  
  get flareLayerTransform() {
    return `translate(-${ this.interpolate(10, 20, 100) }%, -${ this.interpolate(5, 10, 100) }%)`;
  }

  get fakeCarouselTransform() {
    return `translate(-${this.interpolate(0, 80, 100)}%, -50%)`;
  }

  get wrapperStyle() {
    return {
      'transform': `translateX(${ this.interpolate(0, 5) }%)`, 
      'opacity': this.interpolate(1, 0),
      'pointer-events': this.progressPercent() >= 11 ? 'none' : 'auto'
    };
  }

  get sectionNameTransform() {
    return `translateY(${ this.interpolate(0, 101) }%)`;
  }

  get sectionContentTransform() {
    return `translateX(-${ this.interpolate(0, 101) }%)`;
  }

  get separatorWidth() {
    return `${ this.interpolate(100, 0) }%`;
  }

  get releaseSectionTransform() {
    return `translateX(-${ this.interpolate(0, 100) }%)`;
  }

  get buttonTransform() {
    return `translateX(-${ this.interpolate(0, 200) }%)`;
  }
}