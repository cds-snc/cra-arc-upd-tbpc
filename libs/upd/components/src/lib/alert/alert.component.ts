import {
  Component,
  Input,
  OnInit,
  ViewChild,
  ElementRef,
  WritableSignal,
  signal,
} from '@angular/core';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'upd-alert',
    templateUrl: './alert.component.html',
    styleUrls: ['./alert.component.scss'],
    standalone: false
})
export class AlertComponent implements OnInit {
  @ViewChild('staticAlert', { static: false }) staticAlert!: NgbAlert;
  @ViewChild('staticAlert', { read: ElementRef }) alertElementRef!: ElementRef;

  @Input() type: Type = 'success';
  @Input() duration = 5;
  @Input() selfClosing = false;
  @Input() position: Position = 'static';
  @Input() dismissible = true;
  @Input() styleClass = '';
  @Input() widthPercentage = 70;
  alertVisible: WritableSignal<boolean | null> = signal(false);
  style = '';

  ngOnInit(): void {
    this.updateAlert();
  }

  updateAlert(): void {
    this.alertVisible.set(true);
    if (this.selfClosing) {
      setTimeout(() => {
        this.closeAlert();
      }, this.duration * 1000);
    }
    this.getPosition();
    this.focusAlert();
  }

  getPosition(): void {
    switch (this.position) {
      case 'top':
        this.style = `position: fixed; top: 10px; width: ${this.widthPercentage}%; z-index: 99999;`;
        break;
      case 'bottom':
        this.style = `position: fixed; bottom: 5px; width: ${this.widthPercentage}%; z-index: 99999;`;
        break;
      default:
        this.style = '';
        break;
    }
  }

  focusAlert(): void {
    if (this.alertElementRef) {
      this.alertElementRef.nativeElement.focus();
    }
  }

  closeAlert(): void {
    this.alertVisible.set(false);
  }
}

export type Type =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'primary'
  | 'secondary'
  | 'light'
  | 'dark';

export type Position = 'static' | 'top' | 'bottom';
