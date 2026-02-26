import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ScrollManager } from './core/services/scroll-manager';
import { ViewportService } from './core/services/viewport.service';
import { Navbar } from './shared/components/navbar/navbar';
import { NavigationLoader } from './features/navigation-loader/navigation-loader';
import { Scrollbar } from './shared/components/scrollbar/scrollbar';
import { SEOStructuredDataManager } from './core/services/seo-structured-data-manager';
import { ContactModal } from './shared/components/contact-modal/contact-modal';
import { ContactModalService } from './core/services/contact-modal.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Navbar,
    NavigationLoader,
    Scrollbar,
    ContactModal
  ],
  templateUrl: './app.html'
})
export class App {
  protected readonly contactModalService = inject(ContactModalService);
  private readonly scrollManager = inject(ScrollManager);
  private readonly viewportService = inject(ViewportService);
  private readonly seoSchemas = inject(SEOStructuredDataManager);

  constructor() {
    this.viewportService.init();
    this.scrollManager.init();
    this.seoSchemas.addOrganizationSchema();
  }

  @HostListener('window:resize')
  private onResize(): void {
    this.viewportService.updateDimensions();
  }
}