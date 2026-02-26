
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, inject, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-galaxy',
  imports: [],
  templateUrl: './galaxy.html',
  styleUrls: ['./galaxy.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Galaxy implements AfterViewInit, OnDestroy {
  private centerX: number = window.innerWidth / 2;
  private centerY: number = window.innerHeight / 2;
  private resizeScheduled = false;
  private offsetX = 0;
  private offsetY = 0;
  public finalX = 0;
  public finalY = 0;
  
  private readonly SMOOTH_FACTOR = 0.03;
  private animationFrameId: number | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private isVisible = false;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hostElementRef = inject(ElementRef);

  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      this.setupIntersectionObserver();
    });
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible) {
            this.startSmoothUpdate();
          } else {
            this.stopAnimation();
          }
        });
      },
      {
        threshold: 0,
        rootMargin: '0px',
      }
    );

    // Observe the host element instead of the inner div to ensure proper intersection detection
    this.intersectionObserver.observe(this.hostElementRef.nativeElement);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.resizeScheduled) return;
    this.resizeScheduled = true;
    requestAnimationFrame(() => {
      this.updateScreenSize();
      this.resizeScheduled = false;
    });
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove({ clientX, clientY }: MouseEvent) {
    if(!this.isVisible) return;

    this.offsetX = ((clientX - this.centerX) / this.centerX) * 100;
    this.offsetY = ((clientY - this.centerY) / this.centerY) * 100;
  }

  private updateScreenSize() {
    this.centerX = window.innerWidth / 2;
    this.centerY = window.innerHeight / 2;
  }

  private startSmoothUpdate() {
    const animate = () => {
      if (!this.isVisible) {
        this.animationFrameId = null;
        return;
      }

      this.finalX += (this.offsetX - this.finalX) * this.SMOOTH_FACTOR;
      this.finalY += (this.offsetY - this.finalY) * this.SMOOTH_FACTOR;

      this.cdr.markForCheck();

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  get imagePerspective() {
    return `perspective(400px) rotateX(${(-this.finalY * 0.5)}deg) rotateY(${(this.finalX * 0.5)}deg)`;
  }
}