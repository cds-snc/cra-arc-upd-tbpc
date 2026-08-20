import { Component, input } from '@angular/core';
import type { ColumnConfig, LinkColumnConfig } from '@dua-upd/types-common';

interface TaskHeader {
  audience: string[];
  service: string[];
  projects: Record<string, string | number>[];
}

@Component({
  selector: 'upd-project-header',
  templateUrl: './project-header.component.html',
  styleUrls: ['./project-header.component.scss'],
  standalone: false,
})
export class ProjectHeaderComponent {
  config = input<ColumnConfig>({ field: '', header: '' });
  data = input<TaskHeader | null>(null);

  routerLink(
    config: LinkColumnConfig,
    project: Record<string, string | number>,
  ) {
    return [config.preLink, project[config.link], config.postLink].filter(
      (segment) => segment !== undefined && segment !== '',
    );
  }
}
