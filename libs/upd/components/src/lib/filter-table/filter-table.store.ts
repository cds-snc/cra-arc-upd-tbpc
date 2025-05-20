import { inject, Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { I18nFacade } from '@dua-upd/upd/state';
import type { LocaleId } from '@dua-upd/upd/i18n';
import type { TreeNode } from 'primeng/api';
import type { ColumnConfig } from '@dua-upd/types-common';

@Injectable()
export class FilterTableStore<T extends object> extends ComponentStore<
  TreeNode[]
> {
  private i18n = inject(I18nFacade);

  constructor() {
    super([{ label: 'Loading...' }]);
  }

  readonly setData = this.updater(
    (state: TreeNode[], [data, cols]: [T[], ColumnConfig<T>[]]): TreeNode[] => {
      const map = new Map();

      for (const item of data) {
        for (const [key, val] of Object.entries(item)) {
          if (!map.has(key)) {
            map.set(key, new Set());
          }
          const values = map.get(key);
          if (Array.isArray(val)) {
            for (const v of val) {
              values.add(v);
            }
          } else {
            values.add(val);
          }
        }
      }

      const nodes: TreeNode[] = [];
      for (const [key, values] of map.entries()) {
        const column = cols.find((col) => col.field === key);
        if (
          !column ||
          column.pipe === 'number' ||
          column.pipe === 'percent' ||
          column.pipe === 'date' ||
          column.field === 'task' ||
          column.field === 'what_would_improve_comment' ||
          column.field === 'reason_not_complete_comment' ||
          column.field === 'url' ||
          column.field === 'gc_task_other' ||
          column.field === 'tmf_rank'
        ) {
          continue;
        }
        const header = column.header || key;
        const children = [];
        for (const v of values) {
          if (v !== '') {
            children.push({
              label: v,
              data: `${key}|${v}`,
              key: `${key}|${v}`,
            });
          }
        }

        nodes.push({
          label: header,
          data: `${key}|${header}`,
          key: `${key}|${header}`,
          children,
        });
      }

      return nodes;
    },
  );

  readonly setLabels = this.updater((state, lang: LocaleId): TreeNode[] => {
    const nodes = state.map((node) => {
      const [, label] = node.data.split('|');
      return {
        ...node,
        label: this.i18n.service.translate(label, lang),
        children: (node.children as TreeNode[]).map((child) => {
          const [, label] = child.data.split('|');
          return {
            ...child,
            label: this.i18n.service.translate(label, lang),
          };
        }),
      };
    });

    return sortNodes(nodes);
  });

  readonly vm$ = this.select(this.state$, (state) => state);
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  for (const node of nodes) {
    if (node.children) {
      sortNodes(node.children);
    }
  }
  return nodes.sort((a, b) =>
    (a.label as string).localeCompare(b.label as string),
  );
}
