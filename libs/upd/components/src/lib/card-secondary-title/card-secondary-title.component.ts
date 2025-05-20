import { Component, Input } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';

@Component({
    selector: 'upd-card-secondary-title',
    templateUrl: './card-secondary-title.component.html',
    styleUrls: ['./card-secondary-title.component.scss'],
    standalone: false
})
export class CardSecondaryTitleComponent {
  @Input() config: ColumnConfig = { field: '', header: '' };
  @Input() data: Record<string, number | string>[] = [];
  @Input() type = 'list';
  @Input() modal = '';
}
