import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { PCGenerated } from './components/pc-generated/pc-generated';
import { TextBlur } from './components/text-blur/text-blur';
import { NavigationLoaderManager } from '../../core/services/navigation-loader-manager';
import { AboutUIManager } from './services/about-ui-manager';
import { Footer } from '../../shared/components/footer/footer';
import { SEOManager } from '../../core/services/seo-manager';
import { CommonModule } from '@angular/common';

interface SkillCategory {
  category: string;
  entries: string[];
}

@Component({
  selector: 'app-about',
  imports: [
    PCGenerated,
    TextBlur,
    Footer,
    CommonModule
  ],
  templateUrl: './about.html',
  styleUrl: './about.scss',
  providers: [AboutUIManager],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class About implements OnInit {
  public readonly uiManager = inject(AboutUIManager);
  public readonly navigationLoader = inject(NavigationLoaderManager);
  private readonly seoManager = inject(SEOManager);

  public readonly SKILLS: SkillCategory[] = [
    {
      category: 'INTERACTIVE',
      entries: ['3D MODELING', 'BLENDER', 'UNREAL ENGINE']
    },
    {
      category: 'DESIGN',
      entries: ['GRAPHIC DESIGN', 'UI/UX', 'BRANDING']
    },
    {
      category: 'DEVELOPMENT',
      entries: ['ANGULAR', 'TYPESCRIPT', 'WEB DEVELOPMENT']
    },
  ];

  public readonly HERO_TITLE = 'THIS IS KYNSAE';
  public readonly HERO_SUBTITLE = 'SCROLL TO EXPLORE';
  public readonly WHO_TOP_LINES = ['WE ARE KYNSAE', 'A CREATIVE', 'PRODUCTION STUDIO'];
  public readonly SKILLS_TITLE_LINES = ['AREA', 'OF', 'EXPERTISE'];
  public readonly LOCATION_TEXT = 'We operate fully remote. Structured communication and digital workflows allows us to collaborate with partners regardless of time zone or location.';

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
