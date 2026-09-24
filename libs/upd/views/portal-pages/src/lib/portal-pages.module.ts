import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpdComponentsModule } from '@dua-upd/upd-components';

import { PortalPagesRoutingModule } from './portal-pages-routing.module';
import { PortalPagesComponent } from './portal-pages.component';
import { PortalPagesHomeComponent } from './portal-pages-home/portal-pages-home.component';
import { PortalPagesDetailsComponent } from './portal-pages-details/portal-pages-details.component';
import { PortalPagesDetailsSummaryComponent } from './portal-pages-details/portal-pages-details-summary/portal-pages-details-summary.component';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import {
  PortalPagesHomeReducer,
  PORTAL_PAGES_HOME_FEATURE_KEY,
} from './portal-pages-home/+state/portal-pages-home.reducer';
import { PortalPagesHomeEffects } from './portal-pages-home/+state/portal-pages-home.effects';
import { PortalPagesHomeFacade } from './portal-pages-home/+state/portal-pages-home.facade';
import {
  PortalPagesDetailsReducer,
  PORTAL_PAGES_DETAILS_FEATURE_KEY,
} from './portal-pages-details/+state/portal-pages-details.reducer';
import { PortalPagesDetailsEffects } from './portal-pages-details/+state/portal-pages-details.effects';
import { PortalPagesDetailsFacade } from './portal-pages-details/+state/portal-pages-details.facade';
import { ServicesModule, ApiService } from '@dua-upd/upd/services';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { I18nModule } from '@dua-upd/upd/i18n';
import { PipesModule } from '@dua-upd/upd/pipes';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  imports: [
    CommonModule,
    PortalPagesRoutingModule,
    UpdComponentsModule,
    ClipboardModule,
    I18nModule,
    StoreModule.forFeature(PORTAL_PAGES_HOME_FEATURE_KEY, PortalPagesHomeReducer),
    EffectsModule.forFeature([PortalPagesHomeEffects]),
    StoreModule.forFeature(PORTAL_PAGES_DETAILS_FEATURE_KEY, PortalPagesDetailsReducer),
    EffectsModule.forFeature([PortalPagesDetailsEffects]),
    ServicesModule,
    PipesModule,
    NgbAccordionModule,
  ],
  declarations: [
    PortalPagesComponent,
    PortalPagesHomeComponent,
    PortalPagesDetailsComponent,
    PortalPagesDetailsSummaryComponent,
  ],
  providers: [PortalPagesHomeFacade, PortalPagesDetailsFacade, ApiService],
})
export class PortalPagesModule {}
