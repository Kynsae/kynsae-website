import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ProjectsManager } from '../../../core/services/projects-manager';
import { Project } from '../../models/project.model';
import { Router } from '@angular/router';
import { ScrollRestorationManager } from '../../../core/services/scroll-restoration-manager';
import { Parallax } from '../../../core/services/parallax';
import { ScrollManager } from '../../../core/services/scroll-manager';

@Component({
  selector: 'app-projects-grid-mobile',
  templateUrl: './projects-grid-mobile.html',
  styleUrl: './projects-grid-mobile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsGridMobile implements AfterViewInit, OnDestroy {
  @ViewChild('container', { read: ElementRef }) private containerRef?: ElementRef<HTMLElement>;

  private readonly projectsManager = inject(ProjectsManager);
  private readonly router = inject(Router);
  private readonly scrollRestoration = inject(ScrollRestorationManager);
  private readonly parallax = inject(Parallax);
  private readonly scrollManager = inject(ScrollManager);
  private readonly platformId = inject(PLATFORM_ID);

  public maxProjects = input<number>();
  public loadProgress = output<number>();

  public projects: Project[] = [];

  /** Document top of the grid container (px). */
  private containerTop = 0;
  /** Height of one project card (px). */
  private itemHeight = 0;
  /** Gap between cards (px). */
  private gap = 0;
  private viewportHeight = 0;

  constructor() {
    const allProjects = this.projectsManager.getAll();

    const max = this.maxProjects();

    if (max !== undefined && max !== null) {
      this.projects = allProjects.slice(0, max);
    }
    else {
      this.projects = allProjects.slice();
    }

    setTimeout(() => {
      this.loadProgress.emit(100);
    }, 200);
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.measureLayout();
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private resizeListener = (): void => {
    this.measureLayout();
  };

  private measureLayout(): void {
    const container = this.containerRef?.nativeElement;
    if (!container?.firstElementChild || typeof window === 'undefined') return;

    const scrollY = this.scrollManager.actualScroll();
    const rect = container.getBoundingClientRect();
    this.containerTop = rect.top + scrollY;
    this.viewportHeight = window.innerHeight;

    const firstCard = container.firstElementChild as HTMLElement;
    this.itemHeight = firstCard.getBoundingClientRect().height;

    const gapStr = getComputedStyle(container).gap;
    this.gap = gapStr ? parseFloat(gapStr) || 0 : 0;
  }

  /**
   * Page range (in viewport units) so Parallax.lerp runs while this card scrolls through the viewport.
   * startY = (pageStart - 1) * vh, endY = pageEnd * vh.
   */
  private getPageRange(index: number): { pageStart: number; pageEnd: number } {
    if (this.viewportHeight <= 0) return { pageStart: 0, pageEnd: 1 };
    const cardTop = this.containerTop + index * (this.itemHeight + this.gap);
    const cardBottom = cardTop + this.itemHeight;
    return {
      pageStart: cardTop / this.viewportHeight,
      pageEnd: cardBottom / this.viewportHeight,
    };
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

  public navigate(projectId: string): void {
    this.scrollRestoration.saveCurrentPosition();
    this.router.navigateByUrl('/work/' + projectId);
  }

  public transform(index: number): string {
    const { pageStart, pageEnd } = this.getPageRange(index);
    const y = this.lerp(-60, 60, pageStart, pageEnd);
    return `translateY(${y}px)`;
  }
}