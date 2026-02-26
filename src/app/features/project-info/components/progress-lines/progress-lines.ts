import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-progress-lines',
  imports: [],
  templateUrl: './progress-lines.html',
  styleUrl: './progress-lines.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressLines {
  public progressPercent = input<number>(0);

  private readonly LINES_COUNT: number = 14;

  get range() {
    return Array.from({ length: this.LINES_COUNT }, (_, i) => i);
  }

  public getOpacity(index: number): number {
    const maxIndex = this.LINES_COUNT - 1;
    const position = (Math.max(0, Math.min(100, this.progressPercent())) / 100) * maxIndex;
    const distance = Math.abs(index - position);
    return 0.2 + (1 - Math.min(1, distance)) * 1.0;
  }
}