import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TextHoverSlide } from '../text-hover-slide/text-hover-slide';
import { NavigationLoaderManager } from '../../../core/services/navigation-loader-manager';

@Component({
  selector: 'app-navbar',
  imports: [
    TextHoverSlide
],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss', './navbar-mobile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  protected readonly ROUTES = [
    { 
      title: 'Σ LAB', 
      url: 'https://lab.kynsae.com/', 
      delay: '.0s' 
    },
    { 
      title: 'Φ WORK',
      url: '/work',
      delay: '.05s' 
    },
    { 
      title: 'Γ ABOUT',
      url: '/about',
      delay: '.15s' 
    },
    { 
      title: 'Δ CONTACT',
      url: '/contact',
      delay: '.2s' 
    }
  ];

  protected readonly MOBILE_ROUTES = [
    { 
      title: 'λ HOME', 
      url: '', 
      delay: '.0s' 
    },
    { 
      title: 'Φ WORK',
      url: '/work',
      delay: '.03s' 
    },
    { 
      title: 'Γ ABOUT',
      url: '/about',
      delay: '.06s' 
    },
    { 
      title: 'Δ CONTACT',
      url: '/contact',
      delay: '.09s' 
    },
    { 
      title: 'Σ THE LAB', 
      url: 'https://lab.kynsae.com/', 
      delay: '.12s' 
    },
  ];

  public mobileMenuOpen = signal(false);

  private readonly router = inject(Router);
  public readonly navigationLoader = inject(NavigationLoaderManager);

  public navigate(route: string): void {
    this.mobileMenuOpen.set(false);
    this.router.navigateByUrl(route);
  }

  public openExternal(url: string): void {
    this.mobileMenuOpen.set(false);
    window.open(url, '_blank', 'noopener');
  }

  public isExternal(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  public openMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  public isRouteActive(routeUrl: string): boolean {
    const currentUrl = this.router.url.split('?')[0];
    if (routeUrl === '' || routeUrl === '/') {
      return currentUrl === '' || currentUrl === '/';
    }
    return currentUrl === routeUrl;
  }
}