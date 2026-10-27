import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PortalPagesComponent } from './portal-pages.component';
import { PortalPagesDetailsSummaryComponent } from './portal-pages-details/portal-pages-details-summary/portal-pages-details-summary.component';
import { PortalPagesUrlRedirectGuard } from './portal-pages-url-redirect.guard';
import { PagesHomeComponent } from '../pages-home/pages-home.component';
import { PagesDetailsComponent } from '../pages-details/pages-details.component';
import type { ColumnConfig } from '@dua-upd/types-common';

const portalPagesHomeColumns: ColumnConfig[] = [
  {
    field: 'title',
    header: 'Title',
    type: 'link',
    typeParam: '_id',
    width: '225px'
  },
  {
    field: 'screen_id',
    header: 'Screen ID',
  },
  {
    field: 'lang',
    header: 'Language',
    translate: true,
  },
  {
    field: 'type',
    header: 'Type',
    type: 'label',
    typeParam: 'portalPageType',
    width: '225px',
    filterConfig: {
      type: 'portalPageType',
      categories: [
        { name: 'ams-cms', value: 'ams-cms' },
        { name: 'individuals', value: 'individuals' },
        { name: 'business', value: 'business' },
        { name: 'represent-client', value: 'represent-client' },
        { name: 'trusts', value: 'trusts' },
        { name: 'registered-plans', value: 'registered-plans' },
        { name: 'non-resident', value: 'non-resident' },
        { name: 'charities', value: 'charities' },
        { name: 'applications', value: 'applications' },
      ],
    },
  },
  {
    field: 'url',
    header: 'URL',
    type: 'link',
    typeParams: { link: 'url', external: true },
  },
  {
    field: 'visits',
    header: 'visits',
    pipe: 'number',
  },
];

const portalPagesNavTabs = [{ href: 'summary', title: 'tab-summary' }];

const routes: Routes = [
  {
    path: '',
    component: PortalPagesComponent,
    children: [
      {
        path: '',
        component: PagesHomeComponent,
        pathMatch: 'full',
        canActivate: [PortalPagesUrlRedirectGuard],
        data: {
          pageTitle: 'Portal Pages',
          cardTitle: 'List of all portal pages',
          idPrefix: 'portal-pages-home-',
          columns: portalPagesHomeColumns,
        },
      },
      {
        path: ':id',
        component: PagesDetailsComponent,
        data: {
          basePath: 'pages/portal',
          backLabel: 'Portal Pages',
          navTabs: portalPagesNavTabs,
          showProjectHeader: false,
          showLangToggle: true,
        },
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
