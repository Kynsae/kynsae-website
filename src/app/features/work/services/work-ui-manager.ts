import { inject, Injectable } from '@angular/core';
import { Parallax } from '../../../core/services/parallax';
import { ScrollManager } from '../../../core/services/scroll-manager';

@Injectable()
export class WorkUIManager {
    private readonly parallax = inject(Parallax);
    private readonly scrollManager = inject(ScrollManager);

    public getTransitionDelay(index: number, baseDelayInSecond: number = 0.0): string {
        return this.parallax.getTransitionDelay(index, baseDelayInSecond, 0.03);
    }
  
    public lerp(
        rangeStart: number, 
        rangeEnd: number, 
        pageStart: number, 
        pageEnd: number,
    ): number {
        return this.parallax.lerp(
            rangeStart, 
            rangeEnd, 
            pageStart, 
            pageEnd,
            this.scrollManager.actualScroll()
        );
    }

    /*
    ---------------------------------------------
    Styles getter
    ---------------------------------------------
    */

    get mainTitleTransform() {
        return `translateY(${ this.lerp(0, 100, 1, 2) }%)`;
    }
}