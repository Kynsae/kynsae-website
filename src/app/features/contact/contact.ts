import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Torus } from './component/torus/torus';
import { Footer } from '../../shared/components/footer/footer';
import { NavigationLoaderManager } from '../../core/services/navigation-loader-manager';
import { ContactUIManager } from './services/contact-ui-manager';
import { Parallax } from '../../core/services/parallax';
import { SEOManager } from '../../core/services/seo-manager';

@Component({
  selector: 'app-contact',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Torus,
    Footer
],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
  providers: [
    ContactUIManager
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Contact implements OnInit {
  public readonly navigationLoader = inject(NavigationLoaderManager);
  public readonly uiManager = inject(ContactUIManager);
  private readonly parallax = inject(Parallax);
  private readonly seoManager = inject(SEOManager);

  constructor() {
    this.navigationLoader.startLoading(1);
  }

  ngOnInit(): void {
    this.seoManager.updateTags({
      title: 'Kynsae - Contact',
      description: 'Get in touch with Kynsae. We\'re always open to discussing new projects, creative ideas, or opportunities.',
      keywords: 'contact, get in touch, hire, collaboration',
      type: 'website'
    });
  }

  public load(progress: number): void {
    this.navigationLoader.updateSourceProgress(0, progress);
  }

  public getTransitionDelay(index: number, baseDelayInSecond: number = 0.0, diff: number = 0.2): string {
    return this.parallax.getTransitionDelay(index, baseDelayInSecond, diff);
  }
}