import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, OnDestroy, OnInit, output, viewChild } from '@angular/core';

import { Subscription } from 'rxjs';
import { GridScene } from './services/grid-scene';
import { RenderEngine } from './services/render-engine';
import { Router } from '@angular/router';
import { ScrollRestorationManager } from '../../../core/services/scroll-restoration-manager';
import { Project } from '../../models/project.model';
import { ProjectsManager } from '../../../core/services/projects-manager';

@Component({
  selector: 'app-projects-grid',
  templateUrl: './projects-grid.html',
  styleUrl: './projects-grid.scss',
  providers: [GridScene, RenderEngine],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsGrid implements OnInit, AfterViewInit, OnDestroy {
  public containerRef = viewChild.required<ElementRef>('rendererContainer');
  public inlineGridRef = viewChild.required<ElementRef>('inlineGrid');

  private readonly router = inject(Router);
  private readonly scrollRestoration = inject(ScrollRestorationManager);
  private readonly projectsManager = inject(ProjectsManager);
  private readonly gridScene = inject(GridScene);

  public maxProjects = input<number>(); 
  public loadProgress = output<number>();

  private scrollRafId: number | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private progressSubscription: Subscription | null = null;

  public get projects(): readonly Project[] {
    const allProjects = this.projectsManager.getAll();
    const max = this.maxProjects();
    if (max !== undefined && max !== null) {
      return allProjects.slice(0, max);
    }
    return allProjects;
  }

  ngOnInit(): void {
    this.progressSubscription = this.gridScene.loadProgress$.subscribe(progress => {
      this.loadProgress.emit(progress);
    });
  }

  ngAfterViewInit(): void {
    this.gridScene.init(this.containerRef(), this.projects);
    this.setupIntersectionObserver();
  }

  navigate(projectId: string) {
    this.scrollRestoration.saveCurrentPosition();
    this.router.navigateByUrl('/work/' + projectId)
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.scrollRafId === null) {
      this.scrollRafId = requestAnimationFrame(() => {
        this.gridScene.onScroll();
        this.scrollRafId = null;
      });
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.gridScene.onResize();
  }

  ngOnDestroy(): void {
    if (this.scrollRafId !== null) {
      cancelAnimationFrame(this.scrollRafId);
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = null;
    }
    this.gridScene.destroy(this.containerRef().nativeElement);
  }

  private setupIntersectionObserver(): void {
    if (!this.inlineGridRef().nativeElement) return;

    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: '0px',
      threshold: 0.14
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('el-visible');
        } else {
          entry.target.classList.remove('el-visible');
        }
      });
    }, options);

    const elements = this.inlineGridRef().nativeElement.querySelectorAll('.el');
    elements.forEach((el: Element) => this.intersectionObserver?.observe(el));
  }

  onMouseEnter(index: number): void {
    this.gridScene.setHoveredIndex(index);
  }

  onMouseLeave(): void {
    this.gridScene.setHoveredIndex(null);
  }

  onMouseMove(event: MouseEvent, index: number): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    this.gridScene.setHoverUv(index, u, v);
  }
}