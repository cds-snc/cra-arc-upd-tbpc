import { Component, input, Input } from '@angular/core';
import type { ColumnConfig } from '@dua-upd/types-common';

@Component({
    selector: 'upd-project-header',
    templateUrl: './project-header.component.html',
    styleUrls: ['./project-header.component.scss'],
    standalone: false
})
export class ProjectHeaderComponent {
  @Input() config: ColumnConfig = { field: '', header: '' };
  @Input() data: Record<string, number | string>[] = [];

  service = input<string[]>([]);
}
