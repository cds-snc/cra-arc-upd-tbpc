import {
  Component,
  ContentChild,
  inject,
  Input,
  TemplateRef,
} from '@angular/core';
import { NgbPopoverConfig } from '@ng-bootstrap/ng-bootstrap';
import type { ColumnConfig } from '@dua-upd/types-common';

@Component({
  selector: 'upd-card',
  template: `
    <div
      class="card"
      [ngClass]="[
        !flushBody ? 'pt-2' : 'overflow-hidden',
        status ? 'status-card' : '',
        status ? 'status-' + status : '',
        cardHeight,
        styleClass,
      ]"
      tabindex="0"
    >
      <div
        class="card-body h-100"
        [ngClass]="flushBody ? 'p-0' : 'card-pad pt-2'"
      >
        @if (!flushBody || title !== '') {
          <div
            class="d-flex justify-content-between"
            [ngClass]="flushBody ? 'card-pad pt-2' : ''"
          >
            @if (title !== '') {
              <h3
                [class]="'modal-icon-alignment card-title pb-2 ' + titleSize"
                [class.card-tooltip]="titleTooltip"
              >
                <span
                  placement="top"
                  ngbTooltip="{{ titleTooltip | translate }}"
                >
                  {{ title | translate }}

                  @if (titleSuffix) {
                    <span class="title-suffix">
                      - {{ titleSuffix | translate }}
                    </span>
                  }
                </span>

                @if (cardTitleAction) {
                  <span class="modal-icon-by-title">
                    <ng-container
                      [ngTemplateOutlet]="cardTitleAction"
                    ></ng-container>
                  </span>
                } @else if (modal) {
                  <span class="modal-icon-by-title">
                    <upd-modal
                      [modalTitle]="title"
                      [modalContent]="modal"
                      [modalSize]="modalSize"
                    ></upd-modal>
                  </span>
                }
              </h3>
            }

            <upd-card-secondary-title
              [config]="config"
              [data]="data"
              [type]="type"
              [modal]="modal"
            ></upd-card-secondary-title>
          </div>
        }

        <ng-content></ng-content>
      </div>
    </div>
  `,
  styleUrls: ['./card.component.css'],
  providers: [NgbPopoverConfig],
  standalone: false,
})
export class CardComponent {
  private popoverConfig: NgbPopoverConfig;
  @ContentChild('cardTitleAction', { read: TemplateRef })
  cardTitleAction?: TemplateRef<unknown>;

  @Input() title = '';
  @Input() titleSuffix = '';
  @Input() titleTooltip = '';
  @Input() titleSize: CardTitleSize = 'h6';
  @Input() h = 0;
  @Input() config: ColumnConfig = { field: '', header: '' };
  @Input() data: Record<string, number | string>[] = [];
  @Input() type = 'list';
  @Input() modal = '';
  @Input() modalSize: 'xl' | 'lg' | 'md' | 'sm' = 'md';
  @Input() styleClass = '';
  @Input() status?: 'green' | 'yellow' | 'blue' | 'red' | 'grey';
  @Input() flushBody = false;

  constructor() {
    const popoverConfig = inject(NgbPopoverConfig);

    popoverConfig.disablePopover = this.titleTooltip !== '';
    popoverConfig.placement = 'right';
    popoverConfig.triggers = 'hover focus';

    this.popoverConfig = popoverConfig;
  }

  get cardHeight() {
    return this.h !== 0 ? 'h-' + this.h : '';
  }
}

export type CardTitleSize = 'h3' | 'h4' | 'h5' | 'h6';
