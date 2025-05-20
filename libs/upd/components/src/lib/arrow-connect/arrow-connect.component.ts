import {
  Component,
  ElementRef,
  HostListener,
  effect,
  signal,
  input,
} from '@angular/core';

@Component({
    selector: 'upd-arrow-connect',
    templateUrl: './arrow-connect.component.html',
    styleUrls: ['./arrow-connect.component.css'],
    standalone: false
})
export class ArrowConnectComponent {
  source = input<ElementRef<HTMLElement>>();
  target = input<ElementRef<HTMLElement>>();
  visible = input<boolean>(false);
  update = input<boolean>(false);

  previous = signal(false);
  next = signal(false);

  line1StartX = signal(0);
  line1StartY = signal(0);
  line1EndX = signal(0);
  line1EndY = signal(0);

  line2StartX = signal(0);
  line2StartY = signal(0);
  line2EndX = signal(0);
  line2EndY = signal(0);

  line3StartX = signal(0);
  line3StartY = signal(0);
  line3EndX = signal(0);
  line3EndY = signal(0);

  constructor(private hostElement: ElementRef) {
    effect(
      () => {
        if (this.visible() && this.update()) {
          this.updateLine();
        } else {
          this.clearLine();
        }
      }
    );
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.updateLine();
  }

  clearLine() {
    this.line1StartX.set(0);
    this.line1StartY.set(0);
    this.line1EndX.set(0);
    this.line1EndY.set(0);

    this.line2StartX.set(0);
    this.line2StartY.set(0);
    this.line2EndX.set(0);
    this.line2EndY.set(0);

    this.line3StartX.set(0);
    this.line3StartY.set(0);
    this.line3EndX.set(0);
    this.line3EndY.set(0);
  }

  updateLine() {
    const source = this.source();
    const target = this.target();

    if (!source || !target) {
      this.clearLine();

      return;
    }

    //todo make this dynamic
    const previous = source.nativeElement.classList.contains('previous-flow-item');
    const next = target.nativeElement.classList.contains('next-flow-item');

    this.previous.set(previous);
    this.next.set(next);

    const sourceRect = source.nativeElement.getBoundingClientRect();
    const targetRect = target.nativeElement.getBoundingClientRect();

    const containerRect =
      this.hostElement.nativeElement.parentElement.getBoundingClientRect();
    const offsetX = containerRect.left;
    const offsetY = containerRect.top;

    previous ? this.line1StartX.set(sourceRect.right - offsetX + 10) : this.line1StartX.set(sourceRect.right - offsetX);
    this.line1StartY.set(sourceRect.top + sourceRect.height / 2 - offsetY);
    this.line1EndX.set((sourceRect.right + targetRect.left) / 2 - offsetX);
    this.line1EndY.set(sourceRect.top + sourceRect.height / 2 - offsetY);

    this.line2StartX.set((sourceRect.right + targetRect.left) / 2 - offsetX);
    this.line2StartY.set(sourceRect.top + sourceRect.height / 2 - offsetY);
    this.line2EndX.set((sourceRect.right + targetRect.left) / 2 - offsetX);
    this.line2EndY.set(targetRect.top + targetRect.height / 2 - offsetY);

    this.line3StartX.set((sourceRect.right + targetRect.left) / 2 - offsetX);
    this.line3StartY.set(targetRect.top + targetRect.height / 2 - offsetY);
    
    next ? this.line3EndX.set(targetRect.left - offsetX - 12) : this.line3EndX.set(targetRect.left - offsetX - 2);
    this.line3EndY.set(targetRect.top + targetRect.height / 2 - offsetY);
  }
}
