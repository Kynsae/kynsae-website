import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, OnInit, input, effect } from '@angular/core';

@Component({
  selector: 'app-text-blur',
  imports: [CommonModule],
  templateUrl: './text-blur.html',
  styleUrl: './text-blur.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextBlur implements OnInit {
  public text = input.required<string>();
  public delay = input<number>(0);
  public disableBlur = input<boolean>(false);

  public lettersWithDelay: { letter: string, delay: number, delayClass: string }[] = [];

  constructor() {
    effect(() => {
      this.generateDelays();
    });
  }

  ngOnInit(): void {
    this.generateDelays();
  }

  private generateDelays(): void {
    this.lettersWithDelay = this.text().split('').map((letter) => {
      // Generate a random delay that's always >= base delay + small offset
      // This ensures no letter appears before the minimum delay
      const randomDelay = Math.random() * (0.4 - 0.1) + 0.1;
      const delayValue = this.delay() + randomDelay;
      // Round to 2 decimal places and ensure it's never below base delay
      // Strictly enforce minimum delay to prevent any letters appearing early
      const roundedDelay = Math.max(this.delay(), Math.round(delayValue * 100) / 100);
      // Ensure delay is never 0 or negative
      const finalDelay = Math.max(0.01, roundedDelay);
      const delayClass = `delay-${finalDelay.toFixed(2).replace('.', '-')}`;

      return { letter, delay: finalDelay, delayClass };
    });
  }
}