import { computed, inject, Injectable } from '@angular/core';
import { Parallax } from '../../../core/services/parallax';
import { ScrollManager } from '../../../core/services/scroll-manager';
import { EasingType } from '../../../shared/models/easing.type';

@Injectable()
export class AboutUIManager {
  private readonly parallax = inject(Parallax);
  private readonly scrollManager = inject(ScrollManager);

  // Animation constants
  private readonly fadeRange = 0.15;
  private readonly fadeMargin = this.fadeRange / 2;
  
  // Content constants
  public readonly missionSubtitle = 'OUR MISSION';
  public readonly missionLines = ['WE MIX CREATIVITY AND', 'TECH TO MAKE YOUR PROJECT', 'STAND OUT'];
  public readonly whoBottomLines = ['WE MIX CREATIVITY AND', 'TECH TO MAKE YOUR PROJECT', 'STAND OUT'];
  
  // Threshold arrays for letter animations
  private readonly subtitleThresholds = this.missionSubtitle.split('').map(() => this.fadeMargin + Math.random() * (1 - this.fadeRange));
  private readonly letterThresholds = this.missionLines.map(line => line.split('').map(() => this.fadeMargin + Math.random() * (1 - this.fadeRange)));

  public getSubtitleLetterOpacity(charIndex: number): number {
    return this.getLetterOpacity(-1, charIndex);
  }

  public getLetterOpacity(lineIndex: number, charIndex: number): number {
    const threshold = lineIndex === -1 ? this.subtitleThresholds[charIndex] : this.letterThresholds[lineIndex]?.[charIndex];
    const progress = this.lerp(0, 1, 5, 5.4);
    const t = Math.max(0, Math.min(1, (progress - threshold + this.fadeMargin) / this.fadeRange));
    return 1 - (t * t * (3 - 2 * t));
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

  // POINT CLOUD

  get pcPercentage() {
    return this.lerp(0, 1, 1, 10);
  }

  get pcTransform() {
    return `translateY(${ this.lerp(0, -120, 11, 11.8, 'ease-in-out') }%)`;
  }

  // FAKE PLANET

  get fakePlanet() {
    return {
      'top': this.lerp(60, 48, 9.8, 9.8, 'ease-in-out') - this.lerp(0, 95, 11, 11.7, 'ease-in-out') + '%',
      'background-position-y': this.lerp(-150, 0, 9.8, 9.8, 'ease-in-out') + 'px',
      'background-size': this.lerp(110, 100, 9.8, 9.8, 'ease-in-out') + '%'
    };
  }

  // HERO

  get heroTitleTransform() {
    return `translateY(-${ this.lerp(0, 120, 1, 1.7, 'ease-in-out') }%)`;
  }

  get heroSubtitleTransform() {
    return `translateY(-${ this.lerp(0, 200, 1, 1.5, 'ease-in-out') }%)`;
  }

  // WHO SECTION

  get whoOpacity() {
    return this.lerp(0, 1, 2.2, 1.8) - this.lerp(0, 1, 3.2, 2.7);
  }

  public whoTextTopTransform(index: number): string {
    return `translateX(${ this.lerp(50 + index * 15, 0, 1.5, 1.9, 'ease-in-out') - this.lerp(0, 50 + index * 15, 3.2, 3.2, 'ease-in-out') }vw)`;
  }

  public whoTextBottomTransform(index: number): string {
    return `translateX(${ -this.lerp(50 + index * 15, 0, 1.5, 1.9, 'ease-in-out') + this.lerp(0, 50 + index * 15, 3.2, 3.2, 'ease-in-out') }vw)`;
  }

  // CROSSES SECTION

  get crossesTransform() {
    return `translateY(${ this.lerp(0, -100, 11, 11.7, 'ease-in-out') }%)`;
  }

  get sideCrossHeight() {
    return this.lerp(0, 100, 1.5, 2, 'ease-in-out') + '%';
  }

  get crossIcon1Transform() {
    return 'translateX(-' + (this.lerp(0, 15, 3, 4, 'ease-in-out') - this.lerp(0, 15, 5, 6, 'ease-in-out')) + 'vw)';
  }

  get crossIcon4Transform() {
    return 'translateX(' + (this.lerp(0, 15, 3, 4, 'ease-in-out') - this.lerp(0, 15, 5, 6, 'ease-in-out')) + 'vw)';
  }

  get horizontalBlockerCenterHeight() {
    // First animation: 0 to 100 from pages 1.5 to 2 (stays at 100 after page 2 with clampEnd)
    const firstAnimation = this.lerp(0, 100, 1.5, 2, 'ease-in-out');
    
    // Second animation: 100 to 0 from pages 3 to 4 (stays at 100 before page 3 with clampStart)
    const secondAnimation = this.lerp(100, 0, 3, 4, 'ease-in-out');
    
    // Use Math.min to combine: first animation controls 0→100, second controls 100→0
    return Math.min(firstAnimation, secondAnimation) - this.lerp(0, -100, 5, 7, 'ease-in-out') + '%'
  }

  // MISSION SECTION

  get missionTitle() {
    return {
      'transform': `translateY(${ this.lerp(100, 0, 3.7, 3.7, 'ease-in-out') }%)`,
      'opacity': this.lerp(0, 1, 3.7, 3.7, 'ease-in-out')
    }
  }

  public missionText(lineIdx: number) {
    return {
      'transform': `translateY(${ this.lerp(100 + lineIdx * 100, 0, 3.5, 4, 'ease-in-out') }%)`,
      'opacity': this.lerp(0, 1, 3.7 + lineIdx * 0.1, 4 + lineIdx * 0.1, 'ease-in-out')
    }
  }

  // LOCATION SECTION

  get location1Title() {
    return {
      'transform': 'translateY(' + (this.lerp(100, 0, 5.8, 6, 'ease-in-out') - this.lerp(0, 100, 7.9, 8.1, 'ease-in-out')) + '%)',
      'opacity': this.lerp(0, 1, 5.9, 6, 'ease-in-out') * this.lerp(1, 0, 7.8, 7.6, 'ease-in-out')
    };
  }

  get location1SpacerGrow() {
    return this.lerp(0, 1, 6.7, 7, 'ease-in-out');
  }

  get location1Text() {
    return {
      'transform': `translate(-50%, -${ this.lerp(50, 200, 7.9, 7.9, 'ease-in-out') }%)`,
      'opacity': this.lerp(0, 1, 7.2, 7, 'ease-in-out') * this.lerp(1, 0, 7.8, 7.6, 'ease-in-out')
    };
  }

  get location2Title() {
    return {
      'transform': `translateY(${ this.lerp(100, 0, 8, 8.2, 'ease-in-out') - this.lerp(0, 100, 9, 9.2, 'ease-in-out') }%)`,
      'opacity': this.lerp(0, 1, 8.3, 8.3, 'ease-in-out') * this.lerp(1, 0, 8.8, 8.7, 'ease-in-out')
    };
  }

  get location2Text() {
    return {
      'transform': `translate(-50%, ${ this.lerp(200, -50, 7.8, 8, 'ease-in-out') + this.lerp(0, -200, 8.9, 9.1, 'ease-in-out') }%)`,
      'opacity': this.lerp(0, 1, 8.3, 8.3, 'ease-in-out') * this.lerp(1, 0, 8.8, 8.7, 'ease-in-out')
    };
  }

  // SKILLS

  get skills() {
    return {
      'transform': `translateY(${ this.lerp(0, -120, 11, 11.7, 'ease-in-out') }%)`,
      'opacity': this.lerp(0, 1, 10, 10, 'ease-in-out')
    };
  }

  public skillsLine(index: number) {
    return `translateX(${ this.lerp(50 + index * 15, 0, 9.4, 10, 'ease-in-out') }%)`;
  }

  get skillsSubtitle() {
    return {
      'transform': 'translateX(' + this.lerp(40, 0, 9.4, 10, 'ease-in-out') + '%)',
      'opacity': this.lerp(0, 1, 10, 10.3, 'ease-in-out')
    };
  }

  public skillsText(index: number) {
    return {
      'transform': 'translateX(' + this.lerp(50 + index * 10, 0, 9.4, 10, 'ease-in-out') + '%)',
      'opacity': this.lerp(0, 1, 10, 10.3, 'ease-in-out')
    };
  }
}