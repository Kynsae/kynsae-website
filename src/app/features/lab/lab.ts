import { Component, inject } from '@angular/core';
import { NavigationLoaderManager } from '../../core/services/navigation-loader-manager';
import { StarRain } from '../home/components/star-rain/star-rain';
import { Parallax } from '../../core/services/parallax';
import { ScrollManager } from '../../core/services/scroll-manager';
import { EasingType } from '../../shared/models/easing.type';
import { AsciiGrid } from '../home/components/ascii-grid/ascii-grid';
import { StarExposure } from '../home/components/star-exposure/star-exposure';

@Component({
  selector: 'app-lab',
  imports: [
    AsciiGrid,
    StarExposure
  ],
  templateUrl: './lab.html',
  styleUrl: './lab.scss',
})
export class Lab {
  private readonly navigationLoader = inject(NavigationLoaderManager);
  private readonly parallax = inject(Parallax);
  private readonly scrollManager = inject(ScrollManager);


  constructor() {
    this.navigationLoader.startLoading(1);
    this.navigationLoader.updateSourceProgress(0, 100)
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
}
