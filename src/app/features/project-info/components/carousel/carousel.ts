import { Component, ElementRef, HostListener, OnDestroy, inject, ViewChild, Output, EventEmitter, ChangeDetectionStrategy, input, effect, output } from '@angular/core';
import { Project } from '../../../../shared/models/project.model';
import { CarouselEngine } from './services/carousel-engine';

@Component({
  selector: 'app-carousel',
  imports: [],
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
  providers: [CarouselEngine],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Carousel implements OnDestroy {
  @ViewChild('viewport', { static: true }) viewport!: ElementRef<HTMLElement>;

  public progressPercent = output<number>();
  public project = input.required<Project>();
  
  private readonly engine = inject(CarouselEngine);

  constructor() {
    effect(() => {
      this.engine.init(this.viewport.nativeElement, this.project().medias, (p: number) => this.progressPercent.emit(p));
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.engine.resize();
  }

  ngOnDestroy() {
    this.engine.destroy();
  }
}