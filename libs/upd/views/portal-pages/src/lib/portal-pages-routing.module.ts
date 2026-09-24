import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PortalPagesComponent } from './portal-pages.component';
import { PortalPagesHomeComponent } from './portal-pages-home/portal-pages-home.component';
import { PortalPagesDetailsComponent } from './portal-pages-details/portal-pages-details.component';
import { PortalPagesDetailsSummaryComponent } from './portal-pages-details/portal-pages-details-summary/portal-pages-details-summary.component';
import { PortalPagesUrlRedirectGuard } from './portal-pages-url-redirect.guard';

const routes: Routes = [
  {
    path: '',
    component: PortalPagesComponent,
    children: [
      {
        path: '',
        component: PortalPagesHomeComponent,
        pathMatch: 'full',
        canActivate: [PortalPagesUrlRedirectGuard],
      },
      {
        path: ':id',
        component: PortalPagesDetailsComponent,
        children: [
          { path: '', redirectTo: 'summary', pathMatch: 'full' },
          {
            path: 'summary',
            component: PortalPagesDetailsSummaryComponent,
            data: { title: 'Portal Pages | Summary' },
          },
        ],
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PortalPagesRoutingModule {}
