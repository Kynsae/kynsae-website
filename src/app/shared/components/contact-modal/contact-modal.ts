import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
  effect,
  model,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CustomTextarea } from '../custom-textarea/custom-textarea';
import { EmailSender } from '../../../core/services/email-sender';
import { LoadingCircular } from '../loading-circular/loading-circular';
import { StatusPill } from '../status-pill/status-pill';
import { ScrollManager } from '../../../core/services/scroll-manager';

@Component({
  selector: 'app-contact-modal',
  imports: [CustomTextarea, ReactiveFormsModule, LoadingCircular, StatusPill],
  templateUrl: './contact-modal.html',
  styleUrl: './contact-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactModal {
  isOpen = model<boolean>(false);
  submitButton = viewChild<ElementRef<HTMLButtonElement>>('submitButton');
  mouseLabel = viewChild<ElementRef<HTMLDivElement>>('mouseLabel');

  readonly contactForm: FormGroup = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.maxLength(1000), Validators.minLength(3)]],
  });

  wasOpen = signal(false);
  emailError = signal(false);
  messageError = signal(false);
  isLoading = signal(false);
  serverError = signal(false);
  success = signal(false);
  showMouseLabel = signal(false);

  private readonly emailSender = inject(EmailSender);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollManager = inject(ScrollManager);
  private readonly onMouseMove = (e: MouseEvent) => {
    const el = this.mouseLabel()?.nativeElement;
    if (el) {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    }
  };

  constructor() {
    this.contactForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.emailError.set(false);
        this.messageError.set(false);
      });

    effect(() => {
      const open = this.isOpen();
      if (open) {
        this.scrollManager.stop();
        this.wasOpen.set(true);
        this.contactForm.reset();
        this.emailError.set(false);
        this.messageError.set(false);
        this.isLoading.set(false);
        this.serverError.set(false);
        this.resetMouseLabelPosition();
        if (typeof document !== 'undefined') {
          document.addEventListener('mousemove', this.onMouseMove);
        }
      } else if (typeof document !== 'undefined') {
        document.removeEventListener('mousemove', this.onMouseMove);
      }
    });
  }

  closeModal(): void {
    this.success.set(false);
    this.serverError.set(false);
    this.isOpen.set(false);
    this.scrollManager.start();
  }

  submitForm(): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.serverError.set(false);
    this.success.set(false);
    setTimeout(() => this.send(), 1000);
  }

  private send(): void {
    if (this.contactForm.valid) {
      const { email, message } = this.contactForm.value;
      this.emailSender.sendEmail(email, message).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.success.set(true);
          this.contactForm.reset();
        },
        error: () => {
          this.isLoading.set(false);
          this.serverError.set(true);
        },
      });
    } else {
      this.contactForm.markAllAsTouched();
      const emailCtrl = this.contactForm.get('email');
      const msgCtrl = this.contactForm.get('message');
      this.emailError.set(!!(emailCtrl?.invalid && emailCtrl.touched));
      this.messageError.set(!!(msgCtrl?.invalid && msgCtrl.touched));
      this.isLoading.set(false);
    }
    this.submitButton()?.nativeElement?.blur();
  }

  setShowMouseLabel = (isHovering: boolean) => this.showMouseLabel.set(isHovering);

  private resetMouseLabelPosition(): void {
    const el = this.mouseLabel()?.nativeElement;
    if (el) {
      el.style.left = '-100px';
      el.style.top = '-100px';
    }
  }
}