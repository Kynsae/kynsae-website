import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Carousel } from './components/carousel/carousel';
import { ProgressLines } from './components/progress-lines/progress-lines';
import { ProjectsManager } from '../../core/services/projects-manager';
import { ActivatedRoute, Router } from '@angular/router';
import { Project } from '../../shared/models/project.model';
import { CommonModule, Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationLoaderManager } from '../../core/services/navigation-loader-manager';
import { ScrollRestorationManager } from '../../core/services/scroll-restoration-manager';
import { ProjectInfoUIManager } from './services/project-info-ui-manager';
import { SEOManager } from '../../core/services/seo-manager';
import { SEOStructuredDataManager } from '../../core/services/seo-structured-data-manager';

@Component({
  selector: 'app-project-info',
  imports: [
    Carousel,
    ProgressLines,
    CommonModule
  ],
  templateUrl: './project-info.html',
  styleUrl: './project-info.scss',
  providers: [
    ProjectInfoUIManager
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectInfo implements OnInit {
  public project!: Project;

  private readonly projectsManager = inject(ProjectsManager);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navigationLoader = inject(NavigationLoaderManager);
  private readonly scrollRestoration = inject(ScrollRestorationManager);
  private readonly location = inject(Location);
  private readonly seoManager = inject(SEOManager);
  private readonly seoSchemas = inject(SEOStructuredDataManager);

  public readonly uiManager = inject(ProjectInfoUIManager);
  
  constructor() {
    this.navigationLoader.startLoading(1);
    this.fetchProjectID();

    this.updateSEO();
  }

  ngOnInit(): void {
    this.navigationLoader.updateSourceProgress(0, 100);
  }
  
  private updateSEO() {
    if (this.project) {
      const imageUrl = this.project.thumbnail ? `https://kynsae.com/${this.project.thumbnail}` : undefined;
      
      // META TAGS
      this.seoManager.updateTags({
        title: `Kynsae - ${this.project.title}`,
        description: this.project.description,
        keywords: this.project.tags.join(', '),
        image: imageUrl,
        type: 'article',
        url: `https://kynsae.com/work/${this.project.id}`
      });

      // SCHEMAS
      this.seoSchemas.addCreativeWorkSchema(this.project);
    }
  }

  public navigateBack(): void {
    if(this.scrollRestoration.savedPosition) {
      this.location.back();
    }
    else {
      this.router.navigateByUrl('');
    }
  }

  private fetchProjectID(): void {
    this.activatedRoute.paramMap.pipe(takeUntilDestroyed())
    .subscribe(p => {
      this.project = this.projectsManager.getById(p.get('id')!)!;
      
      if(!this.project) {
        this.router.navigateByUrl('');
        return;
      }
    });
  }

  public onLaunchProject(): void {
    if(!this.project.websiteUrl) return;
    window.open(this.project.websiteUrl, '_blank');
  }
}