import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  input
} from '@angular/core';

@Component({
  selector: 'app-svg-animator',
  templateUrl: './svg-animator.html',
  styleUrls: ['./svg-animator.scss']
})
export class SvgAnimator implements AfterViewInit, OnChanges {
  @ViewChild('pathElement') pathElement!: ElementRef<SVGPathElement>;

  public percentage = input<number>(0);
  public startPath = input.required<string>();
  public endPath = input.required<string>();

  public viewBox: string = '0 0 100 100';

  ngAfterViewInit() {
    setTimeout(() => this.updateViewBox());
  }

  ngOnChanges(): void {
    setTimeout(() => this.updateViewBox());
  }

  get interpolatedPath(): string {
    return this.interpolatePaths(this.startPath(), this.endPath(), this.percentage() * 0.01);
  }

  private updateViewBox(): void {
    if (!this.pathElement) return;

    try {
      const bbox = this.pathElement.nativeElement.getBBox();
      this.viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
    } catch {}
  }

  private pathToNumbers(path: string): number[] {
    return path
      .replace(/[a-zA-Z]/g, ' ')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
  }

  private extractCommands(path: string): string[] {
    return path.match(/[a-zA-Z]/g) || [];
  }

  private interpolatePaths(startPath: string, endPath: string, t: number): string {
    const nums1 = this.pathToNumbers(startPath);
    const nums2 = this.pathToNumbers(endPath);

    const cmds1 = this.extractCommands(startPath);
    const cmds2 = this.extractCommands(endPath);

    if (nums1.length !== nums2.length || cmds1.length !== cmds2.length) {
      console.error('Paths are not compatible');
      return startPath;
    }

    const interpolated = nums1.map((n1, i) => n1 + (nums2[i] - n1) * t);

    let path = '';
    let ni = 0;
    for (let ci = 0; ci < cmds1.length; ci++) {
      path += cmds1[ci];
      const count = this.commandParamCount(cmds1[ci]);
      for (let j = 0; j < count; j++) {
        path += (j === 0 ? '' : ',') + interpolated[ni++].toFixed(2);
      }
    }
    return path;
  }

  private commandParamCount(cmd: string): number {
    switch (cmd.toUpperCase()) {
      case 'M':
      case 'L':
      case 'T':
        return 2;
      case 'S':
      case 'Q':
        return 4;
      case 'C':
        return 6;
      case 'A':
        return 7;
      case 'H':
      case 'V':
        return 1;
      case 'Z':
        return 0;
      default:
        return 2;
    }
  }
}