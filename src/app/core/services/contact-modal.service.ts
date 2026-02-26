import { Injectable, signal } from '@angular/core';

/**
 * Manages the contact modal open/close state globally.
 * Used to render the modal at app level so it appears above all content.
 */
@Injectable({
  providedIn: 'root'
})
export class ContactModalService {
  public readonly isOpen = signal(false);

  public open(): void {
    this.isOpen.set(true);
  }

  public close(): void {
    this.isOpen.set(false);
  }

  public toggle(): void {
    this.isOpen.update(v => !v);
  }
}
