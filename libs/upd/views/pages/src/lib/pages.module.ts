import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpdComponentsModule } from '@dua-upd/upd-components';

import { PagesRoutingModule } from './pages-routing.module';
import { PagesComponent } from './pages.component';
import { PagesHomeComponent } from './pages-home/pages-home.component';
import { PagesDetailsComponent } from './pages-details/pages-details.component';
import { PagesDetailsSummaryComponent } from './pages-details/pages-details-summary/pages-details-summary.component';
import { PagesDetailsWebtrafficComponent } from './pages-details/pages-details-webtraffic/pages-details-webtraffic.component';
import { PagesDetailsSearchAnalyticsComponent } from './pages-details/pages-details-search-analytics/pages-details-search-analytics.component';
import { PagesDetailsFeedbackComponent } from './pages-details/pages-details-feedback/pages-details-feedback.component';
import { PagesDetailsFlowComponent } from './pages-details/pages-details-flow/pages-details-flow.component';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import {
  pagesHomeReducer,
  PAGES_HOME_FEATURE_KEY,
} from './pages-home/+state/pages-home.reducer';
import { PagesHomeEffects } from './pages-home/+state/pages-home.effects';
import { PagesHomeFacade } from './pages-home/+state/pages-home.facade';
import {
  pagesDetailsReducer,
  PAGES_DETAILS_FEATURE_KEY,
} from './pages-details/+state/pages-details.reducer';
import { PagesDetailsEffects } from './pages-details/+state/pages-details.effects';
import { PagesDetailsFacade } from './pages-details/+state/pages-details.facade';
import { ServicesModule, ApiService } from '@dua-upd/upd/services';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { I18nModule } from '@dua-upd/upd/i18n';
import { PagesDetailsReadabilityComponent } from './pages-details/pages-details-readability/pages-details-readability.component';
import { PipesModule } from '@dua-upd/upd/pipes';
import { PagesDetailsVersionsComponent } from './pages-details/pages-details-versions/pages-details-versions.component';
import { PagesDetailsAccessibilityComponent } from './pages-details/pages-details-accessibility/pages-details-accessibility.component';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  imports: [
    CommonModule,
    PagesRoutingModule,
    UpdComponentsModule,
    ClipboardModule,
    I18nModule,
    StoreModule.forFeature(PAGES_HOME_FEATURE_KEY, pagesHomeReducer),
    EffectsModule.forFeature([PagesHomeEffects]),
    StoreModule.forFeature(PAGES_DETAILS_FEATURE_KEY, pagesDetailsReducer),
    EffectsModule.forFeature([PagesDetailsEffects]),
    ServicesModule,
    PipesModule,
    NgbAccordionModule,
  ],
  declarations: [
    PagesComponent,
    PagesHomeComponent,
    PagesDetailsComponent,
    PagesDetailsSummaryComponent,
    PagesDetailsWebtrafficComponent,
    PagesDetailsSearchAnalyticsComponent,
    PagesDetailsFeedbackComponent,
    PagesDetailsFlowComponent,
    PagesDetailsReadabilityComponent,
    PagesDetailsVersionsComponent,
    PagesDetailsAccessibilityComponent,
  ],
  providers: [PagesHomeFacade, PagesDetailsFacade, ApiService],
})
export class PagesModule {}
