import { AfterViewInit, Component, effect, inject, input, OnDestroy } from '@angular/core';
import { ProgressCircle } from '../progress-circle/progress-circle';
import { TextHoverSlide } from '../text-hover-slide/text-hover-slide';
import { ScrollSpringManager } from './services/scroll-spring-manager';
import { ContactModalService } from '../../../core/services/contact-modal.service';

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
  styleUrl: './footer.scss',
  providers: [
    ScrollSpringManager
  ]
})
export class Footer implements AfterViewInit, OnDestroy {
  public nextPageTitle = input.required<string>();
  public nextPageRoute = input.required<string>();

  protected readonly contactModalService = inject(ContactModalService);

  private readonly scrollSpringManager = inject(ScrollSpringManager);
  public readonly scrollSpringPercentage = this.scrollSpringManager.scrollPercentage;

  public readonly SOCIAL_LINKS: Link[] = [
    {
      label: 'INSTAGRAM',
      url: 'https://instagram.com/'
    },
    {
      label: 'GITHUB',
      url: 'https://instagram.com/'
    },
    {
      label: 'AWWWARDS',
      url: 'https://instagram.com/'
    },
    {
      label: 'BEHANCE',
      url: 'https://instagram.com/'
    },
  ];

  public readonly CONTACT_LINKS: Link[] = [
    {
      label: 'hello@kynsae.com',
      url: 'mailto:hello@kynsae.com'
    }
  ];

  constructor() {
    effect(() => {
      if (this.contactModalService.isOpen()) {
        this.scrollSpringManager.stop()
      }
      else {
        this.scrollSpringManager.start();
      }
    });
  }

  ngAfterViewInit() {
    this.scrollSpringManager.init({
      maxScrollDistance: window.innerHeight * 0.5,
      stiffness: 0.05,
      damping: 0.85,
      mass: 1,
      wheelTimeout: 150,
      wheelSensitivity: 0.1,
      minPercentage: 0.05,
      routeUrl: this.nextPageRoute()
    });
    
    this.scrollSpringManager.start();
  }

  ngOnDestroy() {
    this.scrollSpringManager.stop();
  }

  public openContactModal(): void {
    this.contactModalService.open();
  }
}