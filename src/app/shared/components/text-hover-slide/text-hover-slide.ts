
import { ChangeDetectionStrategy, Component, effect, input } from '@angular/core';

@Component({
  selector: 'app-text-hover-slide',
  templateUrl: './text-hover-slide.html',
  styleUrl: './text-hover-slide.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextHoverSlide {
  public text = input.required<string>();
  public forceActive = input<boolean>(false);
  public underline = input<boolean>(true);

  public lettersWithDelay: { letter: string, delay: string }[] = [];

  private readonly DELAY_BETWEEN_LETTER: number = 0.01;

  constructor() {
    effect(() => {
      this.generateDelays();
    });
  }

  private generateDelays(): void {
    this.lettersWithDelay = this.text().split('').map((letter, index) => ({
      letter,
      delay: `${index * this.DELAY_BETWEEN_LETTER}s`
    }));
  }
}