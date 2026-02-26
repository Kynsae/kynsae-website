import { ChangeDetectionStrategy, Component, input, Input } from '@angular/core';

@Component({
  selector: 'app-page-separator',
  imports: [],
  templateUrl: './page-separator.html',
  styleUrl: './page-separator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageSeparator {
  public name = input.required<string>();
}
