
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-progress-circle',
  imports: [],
  templateUrl: './progress-circle.html',
  styleUrl: './progress-circle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressCircle {
  public percentage = input<number>(0);
  public size = input<number>(100);
  public strokeWidth = input<number>(3);
  public color = input<string>('#ffffff');
  public hide = input<boolean>(false);

  get radius(): number {
    return (this.size() - this.strokeWidth()) / 2;
  }

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  get offset(): number {
    if (this.hide()) {
      return -this.circumference;
    }
    
    const progress = Math.max(0, Math.min(100, this.percentage()));
    return this.circumference - (progress / 100) * this.circumference;
  }

  get shouldShowProgress(): boolean {
    return this.percentage() >= 0.1;
  }
}