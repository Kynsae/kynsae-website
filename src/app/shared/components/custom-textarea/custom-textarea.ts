import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, Input, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const SCROLLBAR_HEIGHT = 130;
const MIN_THUMB_HEIGHT = 20;

@Component({
  selector: 'app-custom-textarea',
  imports: [],
  templateUrl: './custom-textarea.html',
  styleUrl: './custom-textarea.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomTextarea),
      multi: true
    }
  ]
})
export class CustomTextarea implements AfterViewInit, OnDestroy, ControlValueAccessor {
  public maxlength = input<number>(10);
  public placeholder = input<string>('');

  @ViewChild('textareaRef') textareaRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('customScrollbar') scrollbarRef!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollbarThumb') scrollbarThumbRef!: ElementRef<HTMLDivElement>;

  private textarea!: HTMLTextAreaElement;
  private scrollbar!: HTMLDivElement;
  private scrollbarThumb!: HTMLDivElement;
  private isDragging = false;
  private resizeObserver?: ResizeObserver;
  private onThumbMouseDownBound = this.onThumbMouseDown.bind(this);
  private onMouseMoveBound = this.onMouseMove.bind(this);
  private onMouseUpBound = this.onMouseUp.bind(this);
  private onScrollbarClickBound = this.onScrollbarTrackClick.bind(this);
  
  // ControlValueAccessor implementation
  private onChange = (value: string) => {};
  private onTouched = () => {};
  private value: string = '';

  ngAfterViewInit() {
    setTimeout(() => {
      this.textarea = this.textareaRef.nativeElement;
      this.scrollbar = this.scrollbarRef.nativeElement;
      this.scrollbarThumb = this.scrollbarThumbRef.nativeElement;

      // Set initial value if provided via ControlValueAccessor
      if (this.value) {
        this.textarea.value = this.value;
      } else {
        this.textarea.value = '';
      }

      this.updateScrollbar();
      
      this.scrollbarThumb.addEventListener('mousedown', this.onThumbMouseDownBound);
      this.scrollbar.addEventListener('click', this.onScrollbarClickBound);
      document.addEventListener('mousemove', this.onMouseMoveBound);
      document.addEventListener('mouseup', this.onMouseUpBound);
      
      this.textarea.addEventListener('input', () => {
        this.value = this.textarea.value;
        this.onChange(this.value);
        requestAnimationFrame(() => this.updateScrollbar());
      });
      this.textarea.addEventListener('blur', () => this.onTouched());
      this.textarea.addEventListener('scroll', () => requestAnimationFrame(() => this.updateScrollbarPosition()));
      
      this.resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => this.updateScrollbar()));
      this.resizeObserver.observe(this.textarea);
    }, 0);
  }

  ngOnDestroy() {
    this.scrollbarThumb?.removeEventListener('mousedown', this.onThumbMouseDownBound);
    this.scrollbar?.removeEventListener('click', this.onScrollbarClickBound);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    document.removeEventListener('mouseup', this.onMouseUpBound);
    this.resizeObserver?.disconnect();
  }

  onTextareaScroll(event: WheelEvent) {
    const textarea = event.target as HTMLTextAreaElement;
    const { scrollTop, clientHeight, scrollHeight } = textarea;
    const isScrollingDown = event.deltaY > 0;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
    
    if ((isScrollingDown && !isAtBottom) || (!isScrollingDown && !isAtTop)) {
      event.stopPropagation();
    }
    
    requestAnimationFrame(() => this.updateScrollbarPosition());
  }

  onTextareaScrollEvent() {
    requestAnimationFrame(() => this.updateScrollbarPosition());
  }

  private updateScrollbar() {
    void this.textarea.offsetHeight; // Force reflow
    
    const { scrollHeight, clientHeight } = this.textarea;
    const scrollbarHeight = this.scrollbar.clientHeight || SCROLLBAR_HEIGHT;
    const needsScrollbar = scrollHeight > clientHeight + 1;

    if (!needsScrollbar) {
      this.scrollbar.style.display = 'none';
      return;
    }

    this.scrollbar.style.display = 'block';
    const thumbHeight = Math.max(MIN_THUMB_HEIGHT, (clientHeight / scrollHeight) * scrollbarHeight);
    this.scrollbarThumb.style.height = `${thumbHeight}px`;
    this.updateScrollbarPosition();
  }

  private updateScrollbarPosition() {
    const { scrollHeight, clientHeight, scrollTop } = this.textarea;
    const scrollbarHeight = this.scrollbar.clientHeight || SCROLLBAR_HEIGHT;
    const thumbHeight = parseFloat(this.scrollbarThumb.style.height) || MIN_THUMB_HEIGHT;

    if (scrollHeight <= clientHeight) {
      this.scrollbar.style.display = 'none';
      return;
    }

    this.scrollbar.style.display = 'block';
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) return;

    const scrollRatio = Math.max(0, Math.min(1, scrollTop / maxScroll));
    const maxThumbTop = scrollbarHeight - thumbHeight;
    this.scrollbarThumb.style.top = `${scrollRatio * maxThumbTop}px`;
  }

  private onThumbMouseDown(event: MouseEvent) {
    this.isDragging = true;
    event.preventDefault();
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;

    const scrollbarRect = this.scrollbar.getBoundingClientRect();
    const scrollbarHeight = this.scrollbar.clientHeight;
    const thumbHeight = parseFloat(this.scrollbarThumb.style.height) || MIN_THUMB_HEIGHT;
    const maxThumbTop = scrollbarHeight - thumbHeight;
    
    const mouseY = event.clientY - scrollbarRect.top;
    const newThumbTop = Math.max(0, Math.min(maxThumbTop, mouseY - thumbHeight / 2));
    const scrollRatio = maxThumbTop > 0 ? newThumbTop / maxThumbTop : 0;
    
    const { scrollHeight, clientHeight } = this.textarea;
    const maxScroll = scrollHeight - clientHeight;
    
    if (maxScroll > 0) {
      this.textarea.scrollTop = scrollRatio * maxScroll;
      this.scrollbarThumb.style.top = `${newThumbTop}px`;
    }
  }

  private onMouseUp() {
    this.isDragging = false;
  }

  private onScrollbarTrackClick(event: MouseEvent) {
    if (this.isDragging || event.target !== this.scrollbar) return;

    const scrollbarRect = this.scrollbar.getBoundingClientRect();
    const scrollbarHeight = this.scrollbar.clientHeight;
    const thumbHeight = this.scrollbarThumb.clientHeight;
    const clickY = event.clientY - scrollbarRect.top;
    
    const newThumbTop = Math.max(0, Math.min(scrollbarHeight - thumbHeight, clickY - thumbHeight / 2));
    const maxThumbTop = scrollbarHeight - thumbHeight;
    const scrollRatio = maxThumbTop > 0 ? newThumbTop / maxThumbTop : 0;
    
    const { scrollHeight, clientHeight } = this.textarea;
    this.textarea.scrollTop = scrollRatio * (scrollHeight - clientHeight);
    this.scrollbarThumb.style.top = `${newThumbTop}px`;
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.value = value || '';
    if (this.textarea) {
      this.textarea.value = this.value;
      requestAnimationFrame(() => this.updateScrollbar());
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.textarea) {
      this.textarea.disabled = isDisabled;
    }
  }
}
