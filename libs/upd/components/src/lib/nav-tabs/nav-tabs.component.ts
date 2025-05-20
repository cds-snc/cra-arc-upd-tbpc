import { Component, Input } from '@angular/core';

@Component({
    selector: 'upd-nav-tabs',
    template: `
    <div class="tabs sticky">
      <ul>
        @for (tab of tabs; track $index) {
          <li>
            <a
              [routerLinkActive]="['active']"
              [routerLink]="tab.href"
              [queryParamsHandling]="'merge'"
              translate="tab-{{ tab.href }}"
            >
              {{ tab.title | translate }}
            </a>
          </li>
        }
      </ul>
    </div>
  `,
    standalone: false
})
export class NavTabsComponent {
  @Input() tabs: { href: string; title: string }[] = [];
}
