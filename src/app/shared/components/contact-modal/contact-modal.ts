import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, OnChanges, SimpleChanges, inject, ViewChild, ElementRef, input, effect, model } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CustomTextarea } from '../custom-textarea/custom-textarea';
import { EmailSender } from '../../../core/services/email-sender';
import { LoadingCircular } from '../loading-circular/loading-circular';
import { StatusPill } from '../status-pill/status-pill';
import { NavigationLoaderManager } from '../../../core/services/navigation-loader-manager';
import { ScrollManager } from '../../../core/services/scroll-manager';

@Component({
  selector: 'app-contact-modal',
  imports: [CustomTextarea, ReactiveFormsModule, LoadingCircular, StatusPill],
  templateUrl: './contact-modal.html',
  styleUrl: './contact-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactModal {
  public isOpen = model<boolean>(false);

  @ViewChild('submitButton') submitButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('mouseLabel', { read: ElementRef }) mouseLabel!: ElementRef<HTMLDivElement>;

  readonly contactForm: FormGroup;
  wasOpen = false;
  emailError = false;
  messageError = false;
  isLoading = false;
  serverError = false;
  success = false;
  mouseX = 0;
  mouseY = 0;
  showMouseLabel = false;

  private readonly fb = inject(FormBuilder);
  private readonly emailSender = inject(EmailSender);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly scrollManager = inject(ScrollManager)
  private mouseMoveHandler?: (e: MouseEvent) => void;

  constructor() {
    this.contactForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.maxLength(1000)]]
    });

    this.contactForm.get('email')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.emailError = false;
      this.cdr.markForCheck();
    });

    this.contactForm.get('message')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.messageError = false;
      this.cdr.markForCheck();
    });

    // Create bound mouse move handler
    this.mouseMoveHandler = (e: MouseEvent) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.updateMouseLabelPosition();
    };

    effect(() => {
      if (this.isOpen()) {
        this.scrollManager.stop();
        this.wasOpen = true;
        this.contactForm.reset();
        this.emailError = this.messageError = this.isLoading = false;
        this.serverError = false;
        this.resetMouseLabelPosition();
        // Add mousemove listener when modal opens
        if (typeof document !== 'undefined' && this.mouseMoveHandler) {
          document.addEventListener('mousemove', this.mouseMoveHandler);
        }
        this.cdr.markForCheck();
      } else {
        // Remove mousemove listener when modal closes
        if (typeof document !== 'undefined' && this.mouseMoveHandler) {
          document.removeEventListener('mousemove', this.mouseMoveHandler);
        }
      }
    });
  }

  closeModal(): void {
    this.success = false;
    this.serverError = false;
    this.isOpen.set(false);
    this.cdr.markForCheck();
    this.scrollManager.start();
  }

  submitForm(): void {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.serverError = false;
    this.success = false;

    this.cdr.markForCheck();
    setTimeout(() => this.send(), 1000);
  }

  private send(): void {
    if (this.contactForm.valid) {
      const { email, message } = this.contactForm.value;
      this.emailSender.sendEmail(email, message).subscribe({
        next: () => {
          this.isLoading = false;
          this.success = true;
          this.cdr.markForCheck();
          this.contactForm.reset();
        },
        error: () => {
          this.isLoading = false;
          this.serverError = true;
          this.cdr.markForCheck();
        }
      });
    } else {
      this.contactForm.markAllAsTouched();
      const emailCtrl = this.contactForm.get('email');
      const msgCtrl = this.contactForm.get('message');
      this.emailError = !!(emailCtrl?.invalid && emailCtrl.touched);
      this.messageError = !!(msgCtrl?.invalid && msgCtrl.touched);
      this.isLoading = false;
      this.cdr.markForCheck();
    }
    this.submitButton?.nativeElement?.blur();
  }

  onBackgroundHover(isHovering: boolean): void {
    this.showMouseLabel = isHovering;
    this.cdr.markForCheck();
  }

  onCloseButtonHover(isHovering: boolean): void {
    this.showMouseLabel = isHovering;
    this.cdr.markForCheck();
  }

  private updateMouseLabelPosition(): void {
    if (this.mouseLabel?.nativeElement) {
      this.mouseLabel.nativeElement.style.left = `${this.mouseX}px`;
      this.mouseLabel.nativeElement.style.top = `${this.mouseY}px`;
    }
  }

  private resetMouseLabelPosition(): void {
    if (this.mouseLabel?.nativeElement) {
      this.mouseLabel.nativeElement.style.left = `-100px`;
      this.mouseLabel.nativeElement.style.top = `-100px`;
    }
  }
}