import { inject, Injectable } from '@angular/core';
import { Parallax } from '../../../core/services/parallax';
import { ScrollManager } from '../../../core/services/scroll-manager';
import { EasingType } from '../../../shared/models/easing.type';

@Injectable()
export class HomeUIManager {
  private readonly parallax = inject(Parallax);
  private readonly scrollManager = inject(ScrollManager);

  private page2Location: number = 0;

  public resize(page2Location: number): void {
    this.page2Location = page2Location;
  }

  public lerpOffset(
    rangeStart: number, 
    rangeEnd: number, 
    pageStart: number, 
    pageEnd: number,
    easingType: EasingType = 'linear'
  ): number {
    return this.parallax.lerp(
      rangeStart, 
      rangeEnd, 
      pageStart,
      pageEnd, 
      this.scrollManager.actualScroll() - this.page2Location, 
      easingType
    );
  }

  public lerp(
    rangeStart: number, 
    rangeEnd: number, 
    pageStart: number, 
    pageEnd: number,
    easingType: EasingType = 'linear'
  ): number {
    return this.parallax.lerp(
      rangeStart, 
      rangeEnd, 
      pageStart, 
      pageEnd,
      this.scrollManager.actualScroll(),
      easingType
    );
  }

  /*
  ---------------------------------------------
  Styles getter
  ---------------------------------------------
  */

  // HERO SECTION

  get heroNeonSphereProgress() {
    return this.lerp(0, 1, 1, 5);
  }

  get heroSubtitle() {
    return {
      'transform': `translateY(-${this.lerp(0, 200, 1, 1.3)}%)`,
      'opacity': this.lerp(1, 0, 1, 0.5)
    };
  }

  get heroText() {
    return `linear-gradient(-130deg, rgba(0,0,0,0) ${ this.lerp(100, -200, 2.6, 4.1) }%, rgba(0,0,0,1) ${ this.lerp(200, -150, 2.6, 4.1) }%)`;
  }

  heroTextTransform(index: number) {
    return {
      'transform': `translateY(${this.lerp(100 + 30 * index, 0, 2.2, 3.3, 'ease-in-out') - this.lerp(0, 300, 2.9, 4.8, 'ease-in')}%)`,
      'opacity': this.lerp(1, 0, 3.8, 4.1)
    };
  }

  get circularGridProgress() {
    return this.lerp(0, 1, 1, 5);
  }

  get starRainPercentage() {
    return this.lerp(0, 1, 4.1, 5.3);
  }
  
  get skillsText1Percentage() {
    return this.lerpOffset(0, 100, 1.7, 1.9);
  }

  get skillsText1Top() {
    return this.lerpOffset(120, -25, 1, 2) + 'vh';
  }

  get asciiGridPercentage() {
    return this.lerpOffset(0, 1, 1.3, 5.5);
  }

  get skillsText2Percentage() {
    return this.lerpOffset(0, 100, 5.3, 5.6);
  }

  get skillsText2Spread() {
    return this.lerpOffset(0, 1, 5.8, 6.1, 'ease-in-out');
  }

  get skillsText2Style() {
    return {
      'top': this.lerpOffset(120, 50, 3.8, 5.5, 'ease-in-out') + 'vh',
      'transform': `translate(-50%, -50%) scale(${this.lerpOffset(1, 2, 6.3, 6.8)})`,
      'opacity': this.lerpOffset(1, 0, 6.5, 6.7),
      '--spread': this.skillsText2Spread
    };
  }

  get starExposurePercentage() {
    return this.lerpOffset(0, 1, 6, 9);
  }

  get starExposureFOV() {
    return this.lerpOffset(180, 50, 6, 9, 'ease-in-out');
  }

  get starExposureTrail() {
    return this.lerpOffset(0, .1, 10, 13);
  }

  get svgSubtitleTransform() {
    return `translateY(-${this.lerpOffset(100, 0, 9.1, 9)}%)`;
  }

  get svgPercentage() {
    return this.lerpOffset(0, 150, 10, 12);
  }

  get svgTransform() {
    return `translateY(${this.lerpOffset(110, 0, 9.1, 9)}%)`;
  }

  get asciiGridOpacity() {
    return this.lerpOffset(0, 1, 0, 0.1);
  }
}