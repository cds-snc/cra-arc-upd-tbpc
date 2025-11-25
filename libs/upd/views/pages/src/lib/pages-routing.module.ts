import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PagesComponent } from './pages.component';
import { PagesHomeComponent } from './pages-home/pages-home.component';
import { PagesDetailsComponent } from './pages-details/pages-details.component';
import { PagesDetailsSummaryComponent } from './pages-details/pages-details-summary/pages-details-summary.component';
import { PagesDetailsWebtrafficComponent } from './pages-details/pages-details-webtraffic/pages-details-webtraffic.component';
import { PagesDetailsSearchAnalyticsComponent } from './pages-details/pages-details-search-analytics/pages-details-search-analytics.component';
import { PagesDetailsFeedbackComponent } from './pages-details/pages-details-feedback/pages-details-feedback.component';
import { PagesDetailsFlowComponent } from './pages-details/pages-details-flow/pages-details-flow.component';
import { PagesDetailsReadabilityComponent } from './pages-details/pages-details-readability/pages-details-readability.component';
import { PagesDetailsVersionsComponent } from './pages-details/pages-details-versions/pages-details-versions.component';
import { PagesDetailsAccessibilityComponent } from './pages-details/pages-details-accessibility/pages-details-accessibility.component';

const routes: Routes = [
  {
    path: '',
    component: PagesComponent,
    children: [
      { path: '', component: PagesHomeComponent, pathMatch: 'full' },
      {
        path: ':id',
        component: PagesDetailsComponent,
        children: [
          { path: '', redirectTo: 'summary', pathMatch: 'full' },
          { path: 'summary', component: PagesDetailsSummaryComponent, data: {title: 'Pages | Summary'} },
          { path: 'webtraffic', component: PagesDetailsWebtrafficComponent, data: {title: 'Pages | Web traffic'} },
          { path: 'searchanalytics', component: PagesDetailsSearchAnalyticsComponent, data: {title: 'Pages | Search analytics'} },
          { path: 'pagefeedback', component: PagesDetailsFeedbackComponent, data: {title: 'Pages | Page feedback'} },
          { path: 'flow', component: PagesDetailsFlowComponent, data: {title: 'Pages | Flow'} },
          { path: 'readability', component: PagesDetailsReadabilityComponent, data: {title: 'Pages | Readability'} },
          { path: 'version-history', component: PagesDetailsVersionsComponent, data: {title: 'Pages | Version history'} },
          { path: 'accessibility', component: PagesDetailsAccessibilityComponent, data: {title: 'Pages | Accessibility'} },
        ],
      },
    ],
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagesRoutingModule {}
