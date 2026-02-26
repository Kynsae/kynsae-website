import { CommonModule } from '@angular/common';
import { Component, effect, input } from '@angular/core';

@Component({
  selector: 'app-text-reveal',
  imports: [CommonModule],
  templateUrl: './text-reveal.html',
  styleUrls: ['./text-reveal.scss'],
})
export class TextReveal {
  public text = input.required<string>();
  public percentage = input<number>(0);
  public revealEndPercentage = input<number>(50); // Percentage at which reveal phase completes (0-100)
  /** When true, spacers between words are rendered and grow to fill space (e.g. skills-text-2) */
  public useSpreadLayout = input<boolean>(false);

  private cumulativeCharCounts: number[] = [];

  constructor() {
    effect(() => {
      const words = this.text().split(' ');

      this.cumulativeCharCounts = words.reduce<number[]>((acc, word, i) => {
        acc.push((acc[i - 1] ?? 0) + word.length + (i < words.length - 1 ? 1 : 0));
        return acc;
      }, []);
    });
  }

  public isRevealed(wordIndex: number, charIndex: number): boolean {
    const totalChars = this.cumulativeCharCounts[this.cumulativeCharCounts.length - 1] || 0;
    const prevChars = wordIndex === 0 ? 0 : this.cumulativeCharCounts[wordIndex - 1];
    const charPosition = prevChars + charIndex;
    
    const revealProgress = Math.min(this.percentage() / this.revealEndPercentage(), 1);
    const charsToReveal = Math.floor(revealProgress * totalChars);
    
    return charPosition < charsToReveal;
  }
}