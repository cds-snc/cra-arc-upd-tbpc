import { Component, computed, inject, input, OnInit } from '@angular/core';
import type {
  ColumnConfig,
  PagesHomeAggregatedData,
} from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { PagesHomeFacade } from './+state/pages-home.facade';

const defaultColumns: ColumnConfig<PagesHomeAggregatedData>[] = [
  {
    field: 'title',
    header: 'Title',
    type: 'link',
    typeParam: '_id',
  },
  {
    field: 'pageArchivedStatusLabel',
    header: 'Page status',
    type: 'label',
    typeParam: 'pageArchived',
    filterConfig: {
      type: 'pageArchivedStatus',
      categories: [
        { name: '404', value: '404' },
        { name: 'Redirected', value: 'Redirected' },
        { name: 'Live', value: 'Live' },
        { name: 'Archived', value: 'Archived' },
        { name: 'Not archived', value: 'Not archived' },
      ],
      matchMode: 'arrayContains',
    },
  },
  {
    field: 'url',
    header: 'URL',
    type: 'link',
    typeParams: {
      link: 'url',
      external: true,
    },
  },
  {
    field: 'visits',
    header: 'Visits',
    pipe: 'number',
  },
];

@Component({
  selector: 'upd-pages-home',
  templateUrl: './pages-home.component.html',
  styleUrls: ['./pages-home.component.css'],
  standalone: false,
})
export class PagesHomeComponent implements OnInit {
  private pagesHomeService = inject(PagesHomeFacade);
  private i18n = inject(I18nFacade);

  pageTitle = input<string | undefined>(undefined);
  cardTitle = input<string | undefined>(undefined);
  idPrefix = input<string | undefined>(undefined);

  activePageTitle = computed(() => this.pageTitle() ?? 'Pages');
  activeCardTitle = computed(() => this.cardTitle() ?? 'List of all pages');
  activeIdPrefix = computed(() => this.idPrefix() ?? 'pages-home-');
  columns = input<ColumnConfig<PagesHomeAggregatedData>[]>();

  pagesHomeData$ = this.pagesHomeService.pagesHomeTableData$;
  loading$ = this.pagesHomeService.loading$;

  currentLang$ = this.i18n.currentLang$;
  homeTabs = computed(() => {
    const lang = this.i18n.currentLang();
    const langPath = lang.toLowerCase().startsWith('fr') ? 'fr' : 'en';

    return [
      {
        route: ['/', langPath, 'pages'],
        title: 'menu-pages',
      },
      {
        route: ['/', langPath, 'pages', 'portal'],
        title: 'menu-portal-pages',
      },
    ];
  });

  get effectiveColumns(): ColumnConfig<PagesHomeAggregatedData>[] {
    return this.columns() ?? defaultColumns;
  }

  get searchFields() {
    return this.effectiveColumns.map((col) => col.field);
  }

  ngOnInit() {
    this.pagesHomeService.fetchData();
  }
}
