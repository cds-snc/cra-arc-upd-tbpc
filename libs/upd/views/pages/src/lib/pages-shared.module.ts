import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { UpdComponentsModule } from '@dua-upd/upd-components';
import { I18nModule } from '@dua-upd/upd/i18n';

import { PagesHomeComponent } from './pages-home/pages-home.component';
import { PagesDetailsComponent } from './pages-details/pages-details.component';

@NgModule({
  imports: [CommonModule, RouterModule, UpdComponentsModule, ClipboardModule, I18nModule],
  declarations: [PagesHomeComponent, PagesDetailsComponent],
  exports: [PagesHomeComponent, PagesDetailsComponent],
})
export class PagesSharedModule {}
