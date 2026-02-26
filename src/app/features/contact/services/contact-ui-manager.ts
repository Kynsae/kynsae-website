import { inject, Injectable } from '@angular/core';
import { Parallax } from '../../../core/services/parallax';

@Injectable()
export class ContactUIManager {
    private readonly parallax = inject(Parallax);

    public getTransitionDelay(index: number, baseDelayInSecond: number = 0.0): string {
        return this.parallax.getTransitionDelay(index, baseDelayInSecond);
    }
}
