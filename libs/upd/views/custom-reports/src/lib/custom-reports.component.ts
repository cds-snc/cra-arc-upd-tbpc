import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'dua-upd-custom-reports',
    imports: [CommonModule, RouterOutlet, TranslateModule],
    template: `
    <h2 class="pb-2">{{ 'custom-reports-title' | translate }}</h2>
    <router-outlet></router-outlet>
  `,
    styles: [],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomReportsComponent {}
