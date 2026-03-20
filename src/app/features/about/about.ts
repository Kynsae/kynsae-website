import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { PCGenerated } from './components/pc-generated/pc-generated';
import { TextBlur } from './components/text-blur/text-blur';
import { NavigationLoaderManager } from '../../core/services/navigation-loader-manager';
import { AboutUIManager } from './services/about-ui-manager';
import { Footer } from '../../shared/components/footer/footer';
import { SEOManager } from '../../core/services/seo-manager';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  imports: [
    PCGenerated,
    TextBlur,
    Footer,
    CommonModule
  ],
  templateUrl: './about.html',
  styleUrls: ['./about.scss', './about-mobile.scss'],
  providers: [AboutUIManager],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class About implements OnInit {
  public readonly uiManager = inject(AboutUIManager);
  public readonly navigationLoader = inject(NavigationLoaderManager);
  private readonly seoManager = inject(SEOManager);

  constructor() {
    this.navigationLoader.startLoading(1);
  }

  ngOnInit(): void {
    this.seoManager.updateTags({
      title: 'Kynsae - About Us',
      description: 'Learn about Kynsae, a multidisciplinary creative studio based in Geneva, Switzerland. We specialize in web design, 3D rendering, mobile development, and creative tech.',
      keywords: 'about, creative studio, Geneva, Switzerland, team, expertise',
      type: 'website'
    });
  }

  public onLoadProgress(progress: number): void {
    this.navigationLoader.updateSourceProgress(0, progress);
  }
}
