import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ProjectsGrid } from '../../shared/components/projects-grid/projects-grid';
import { NavigationLoaderManager } from '../../core/services/navigation-loader-manager';

import { Footer } from '../../shared/components/footer/footer';
import { WorkUIManager } from './services/work-ui-manager';
import { ViewportService } from '../../core/services/viewport.service';
import { SEOManager } from '../../core/services/seo-manager';
import { SEOStructuredDataManager } from '../../core/services/seo-structured-data-manager';
import { ProjectsManager } from '../../core/services/projects-manager';
import { ProjectsGridMobile } from '../../shared/components/projects-grid-mobile/projects-grid-mobile';

@Component({
  selector: 'app-work',
  imports: [
    ProjectsGrid,
    ProjectsGridMobile,
    Footer
  ],
  templateUrl: './work.html',
  styleUrls: ['./work.scss', './work-mobile.scss'],
  providers: [
    WorkUIManager
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Work implements OnInit {
  public readonly navigationLoader = inject(NavigationLoaderManager);
  public readonly uiManager = inject(WorkUIManager);
  protected readonly viewportService = inject(ViewportService);
  private readonly seoManager = inject(SEOManager);
  private readonly seoSchemas = inject(SEOStructuredDataManager);
  private readonly projectsManager = inject(ProjectsManager);

  constructor() {
    this.navigationLoader.startLoading(2);
  }

  ngOnInit(): void {
    this.seoSchemas.addPortfolioSchema(this.projectsManager.getAll());

    this.seoManager.updateTags({
      title: 'Kynsae - Our Work',
      description: 'Explore our portfolio of web design, 3D renders, mobile development, and creative projects.',
      keywords: 'portfolio, web design projects, 3D projects, creative work, case studies',
      type: 'website'
    });
  }

  public updateSourceProgress(id: number, percentage: number): void {
    this.navigationLoader.updateSourceProgress(id, percentage);
  }
}