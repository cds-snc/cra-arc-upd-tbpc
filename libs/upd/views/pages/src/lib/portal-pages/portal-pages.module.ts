import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpdComponentsModule } from '@dua-upd/upd-components';

import { PortalPagesRoutingModule } from './portal-pages-routing.module';
import { PortalPagesComponent } from './portal-pages.component';
import { PortalPagesDetailsSummaryComponent } from './portal-pages-details/portal-pages-details-summary/portal-pages-details-summary.component';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { ServicesModule, ApiService } from '@dua-upd/upd/services';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { I18nModule } from '@dua-upd/upd/i18n';
import { PipesModule } from '@dua-upd/upd/pipes';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';
import { PagesSharedModule } from '../pages-shared.module';
import { PagesHomeFacade } from '../pages-home/+state/pages-home.facade';
import { PagesHomeEffects } from '../pages-home/+state/pages-home.effects';
import {
  PAGES_HOME_ACTIONS,
  PAGES_HOME_SELECTORS,
  PAGES_HOME_API_CONFIG,
} from '../pages-home/+state/pages-home.tokens';
import { PagesDetailsFacade } from '../pages-details/+state/pages-details.facade';
import { PagesDetailsEffects } from '../pages-details/+state/pages-details.effects';
import {
  PAGES_DETAILS_ACTIONS,
  PAGES_DETAILS_SELECTORS,
  PAGES_DETAILS_API_CONFIG,
} from '../pages-details/+state/pages-details.tokens';

import {
  PORTAL_PAGES_HOME_FEATURE_KEY,
  portalPagesHomeReducer,
  portalPagesHomeActions,
  portalPagesHomeSelectors,
  portalPagesHomeApiConfig,
} from './portal-pages-home/portal-pages-home.state';
import {
  PORTAL_PAGES_DETAILS_FEATURE_KEY,
  portalPagesDetailsReducer,
  portalPagesDetailsActions,
  portalPagesDetailsSelectors,
  portalPagesDetailsApiConfig,
} from './portal-pages-details/portal-pages-details.state';

@NgModule({
  imports: [
    CommonModule,
    PortalPagesRoutingModule,
    UpdComponentsModule,
    ClipboardModule,
    I18nModule,
    PagesSharedModule, // reuses PagesHomeComponent & PagesDetailsComponent
    StoreModule.forFeature(PORTAL_PAGES_HOME_FEATURE_KEY, portalPagesHomeReducer),
    EffectsModule.forFeature([PagesHomeEffects]),
    StoreModule.forFeature(
      PORTAL_PAGES_DETAILS_FEATURE_KEY,
      portalPagesDetailsReducer,
    ),
    EffectsModule.forFeature([PagesDetailsEffects]),
    ServicesModule,
    PipesModule,
    NgbAccordionModule,
  ],
  declarations: [PortalPagesComponent, PortalPagesDetailsSummaryComponent],
  providers: [
    ApiService,
    PagesHomeFacade,
    PagesDetailsFacade,
    { provide: PAGES_HOME_ACTIONS, useValue: portalPagesHomeActions },
    { provide: PAGES_HOME_SELECTORS, useValue: portalPagesHomeSelectors },
    { provide: PAGES_HOME_API_CONFIG, useValue: portalPagesHomeApiConfig },
    { provide: PAGES_DETAILS_ACTIONS, useValue: portalPagesDetailsActions },
    { provide: PAGES_DETAILS_SELECTORS, useValue: portalPagesDetailsSelectors },
    {
      provide: PAGES_DETAILS_API_CONFIG,
      useValue: portalPagesDetailsApiConfig,
    },
  ],
})
export class PortalPagesModule {}

