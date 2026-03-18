import { Component, effect, inject, input, OnDestroy } from '@angular/core';
import { ProgressCircle } from '../progress-circle/progress-circle';
import { TextHoverSlide } from '../text-hover-slide/text-hover-slide';
import { ScrollSpringManager } from './services/scroll-spring-manager';
import { ContactModalService } from '../../../core/services/contact-modal.service';
import { ViewportService } from '../../../core/services/viewport.service';

interface Link {
  label: string;
  url: string;
}

@Component({
  selector: 'app-footer',
  imports: [
    ProgressCircle,
    TextHoverSlide
  ],
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss', './footer-mobile.scss'],
  providers: [
    ScrollSpringManager
  ]
})
export class Footer implements OnDestroy {
  public nextPageTitle = input.required<string>();
  public nextPageRoute = input.required<string>();

  protected readonly contactModalService = inject(ContactModalService);
  private readonly viewportService = inject(ViewportService);

  private readonly scrollSpringManager = inject(ScrollSpringManager);
  public readonly scrollSpringPercentage = this.scrollSpringManager.scrollPercentage;

  public readonly SOCIAL_LINKS: Link[] = [
    {
      label: 'INSTAGRAM',
      url: 'https://instagram.com/notkynsae'
    },
    {
      label: 'GITHUB',
      url: 'https://github.com/kynsae'
    },
    {
      label: 'X.COM',
      url: 'https://x.com/kynsae'
    },
    {
      label: 'ARTSTATION',
      url: 'https://artstation.com/kynsae'
    },
    {
      label: 'BEHANCE',
      url: 'https://behance.com/kynsae'
    }
  ];

  public readonly CONTACT_LINKS: Link[] = [
    {
      label: 'HELLO@KYNSAE.COM',
      url: 'mailto:hello@kynsae.com'
    }
  ];

  constructor() {
    effect(() => {
      if (this.viewportService.isMobile()) {
        this.scrollSpringManager.stop();
        return;
      }

      this.scrollSpringManager.init({
        maxScrollDistance:
          typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0,
        stiffness: 0.05,
        damping: 0.85,
        mass: 1,
        wheelTimeout: 150,
        wheelSensitivity: 0.1,
        minPercentage: 0.05,
        routeUrl: this.nextPageRoute()
      });

      if (this.contactModalService.isOpen()) {
        this.scrollSpringManager.stop();
      } else {
        this.scrollSpringManager.start();
      }
    });
  }

  ngOnDestroy() {
    this.scrollSpringManager.stop();
  }

  public openContactModal(): void {
    this.contactModalService.open();
  }
}