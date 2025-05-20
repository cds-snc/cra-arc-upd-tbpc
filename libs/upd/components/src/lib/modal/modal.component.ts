import { Component, inject, Input, TemplateRef } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'upd-modal',
    templateUrl: './modal.component.html',
    styleUrls: ['./modal.component.scss'],
    standalone: false
})
export class ModalComponent<T> {
  private modalService = inject(NgbModal);

  @Input() modalTitle = '';
  @Input() buttonTitle = '';
  @Input() modalContent = '';
  @Input() modalSize: 'xl' | 'lg' | 'md' | 'sm' = 'md';

  closeResult = '';

  open(content: TemplateRef<T>) {
    this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title',
      size: this.modalSize,
    });
  }
}
