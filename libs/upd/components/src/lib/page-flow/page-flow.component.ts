import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ColumnConfig, Direction, PageFlowData } from '@dua-upd/types-common';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'upd-page-flow',
    templateUrl: './page-flow.component.html',
    styleUrl: './page-flow.component.css',
    standalone: false
})
export class PageFlowComponent {
  private http = inject(HttpClient);

  url = input<string>('');
  dateRange = input<{ start: string; end: string }>();
  title = input<string>('');
  modal = input<string>('');
  modalSize = input<'xl' | 'lg' | 'md' | 'sm'>('lg');

  previousOptions: WritableSignal<PageFlowData[]> = signal([]);
  nextOptions: WritableSignal<PageFlowData[]> = signal([]);

  previousPages: WritableSignal<PageFlowData[]> = signal([]);
  nextPages: WritableSignal<PageFlowData[]> = signal([]);

  focusPage: WritableSignal<PageFlowData> = signal({
    url: '',
    visits: 0,
    sequence: 'Focus',
    total: 0,
  });

  currentFlow: WritableSignal<{
    previousOptions: PageFlowData[];
    nextOptions: PageFlowData[];
    previousPages: PageFlowData[];
    nextPages: PageFlowData[];
    focusPage: PageFlowData;
  } | null> = signal(null);

  selectedFlow = computed<PageFlowData[]>(() => [
    ...this.previousPages(),
    this.focusPage(),
    ...this.nextPages(),
  ]);

  totalPages = computed(
    () => this.previousPages().length + this.nextPages().length,
  );

  currentFlowCols: ColumnConfig[] = [
    { field: 'sequence', header: 'Sequence' },
    { field: 'title', header: 'Title' },
    { field: 'url', header: 'URL' },
    { field: 'visits', header: 'Visits', pipe: 'number' },
    { field: 'entries', header: 'Entries', pipe: 'number' },
    { field: 'exits', header: 'Exits', pipe: 'number' },
    { field: 'rank', header: 'Rank', pipe: 'number' },
  ];

  isLoadingNext = false;
  isLoadingPrevious = false;
  isInit = signal(true);

  constructor() {
    effect(
      async () => {
        const url = this.url();
        const dateRange = this.dateRange();
        const currentFlow = this.currentFlow();
        const focusPage = this.focusPage();

        if (url && dateRange) {
          const sessionKey = `${url}-${dateRange?.start}-${dateRange?.end}`;
          const parsedStorageData = JSON.parse(
            sessionStorage.getItem(sessionKey) || 'null',
          );

          if (parsedStorageData !== null) {
            if (
              JSON.stringify(currentFlow) !== JSON.stringify(parsedStorageData)
            ) {
              this.currentFlow.set(parsedStorageData);

              this.focusPage.set({
                ...parsedStorageData.focusPage,
                sequence: 'Focus',
              });
              this.previousOptions.set(parsedStorageData.previousOptions);
              this.nextOptions.set(parsedStorageData.nextOptions);
              this.previousPages.set(parsedStorageData.previousPages);
              this.nextPages.set(parsedStorageData.nextPages);

              this.isInit.set(false);
            }
            return;
          }

          this.isInit.set(true);

          const results = await firstValueFrom(
            this.http.get<PageFlowData[]>('/api/pages/flow', {
              params: {
                direction: 'focal',
                limit: 5,
                urls: JSON.stringify(url),
                dateRange: JSON.stringify(dateRange),
              },
            }),
          );

          if (JSON.stringify(focusPage) !== JSON.stringify(results[0])) {
            this.focusPage.set({ ...results[0], sequence: 'Focus' });
          }

          this.currentFlow.set({
            previousOptions: currentFlow?.previousOptions ?? [],
            nextOptions: currentFlow?.nextOptions ?? [],
            previousPages: currentFlow?.previousPages ?? [],
            nextPages: currentFlow?.nextPages ?? [],
            focusPage: { ...results[0], sequence: 'Focus' },
          });

          sessionStorage.setItem(
            sessionKey,
            JSON.stringify(this.currentFlow()),
          );

          if (
            this.currentFlow()?.previousPages.length === 0 &&
            this.currentFlow()?.nextPages.length === 0
          ) {
            await Promise.all([
              this.getPageFlowData('next'),
              this.getPageFlowData('previous'),
            ]);
            this.setCurrentFlowData();
            this.isInit.set(false);
          }
        }
      }
    );

    effect(
      () => {
        const focusPage = this.focusPage();
        const previousPages = this.previousPages();
        const nextPages = this.nextPages();
        const previousOptions = this.previousOptions();
        const nextOptions = this.nextOptions();

        if (
          focusPage &&
          !this.isInit() &&
          (previousPages.length > 0 ||
            nextPages.length > 0 ||
            previousOptions.length > 0 ||
            nextOptions.length > 0)
        ) {
          this.setCurrentFlowData();
        }
      }
    );
  }

  setCurrentFlowData() {
    const sessionKey = `${this.url()}-${this.dateRange()?.start}-${this.dateRange()?.end}`;

    this.currentFlow.set({
      previousOptions: this.previousOptions(),
      nextOptions: this.nextOptions(),
      previousPages: this.previousPages(),
      nextPages: this.nextPages(),
      focusPage: this.focusPage(),
    });

    sessionStorage.setItem(sessionKey, JSON.stringify(this.currentFlow()));
  }

  pageClick(
    direction: Direction,
    limit?: number,
    item?: PageFlowData,
    rank?: number,
  ) {
    limit = limit ?? 5;
    const url = this.url();
    const isPrevious = direction === 'previous';
    const pages = isPrevious ? this.previousPages() : this.nextPages();

    if (item && rank) {
      const newPage = { ...item, rank, sequence: pages.length + 1 };

      if (isPrevious) {
        this.previousOptions.set([]);
        this.previousPages.set([newPage, ...pages]);
      } else {
        this.nextOptions.set([]);
        this.nextPages.set([...pages, newPage]);
      }
    }

    const urls = isPrevious
      ? [...this.previousPages().map((page) => page.url), url]
      : [url, ...this.nextPages().map((page) => page.url)];

    this.getPageFlowData(direction, limit, urls);
  }

  flowClick(item: PageFlowData) {
    const previousPages = this.previousPages();
    const nextPages = this.nextPages();
    const focusPage = this.focusPage();
    const url = this.url();

    const previousIndex = previousPages.indexOf(item);
    const nextIndex = nextPages.indexOf(item);
    const isFocusPage = focusPage === item;

    if (previousIndex !== -1 && nextIndex !== -1 && isFocusPage) return;

    if (previousIndex !== -1) {
      if (previousIndex === 0) return;
      const updatedPreviousPages = previousPages.slice(previousIndex);
      this.previousPages.set(updatedPreviousPages);
      this.getPageFlowData('previous', 5, [
        ...updatedPreviousPages.map((page) => page.url),
        url,
      ]);
    } else if (nextIndex !== -1) {
      if (nextIndex === nextPages.length - 1) return;
      const updatedNextPages = nextPages.slice(0, nextIndex + 1);
      this.nextPages.set(updatedNextPages);
      this.getPageFlowData('next', 5, [
        url,
        ...updatedNextPages.map((page) => page.url),
      ]);
    } else if (isFocusPage) {
      this.previousPages.set([]);
      this.nextPages.set([]);
      if (previousPages.length > 0) {
        this.getPageFlowData('previous');
      }
      if (nextPages.length > 0) {
        this.getPageFlowData('next');
      }
    }
  }

  updateEntriesOrExits(
    pageOptions: PageFlowData[],
    updateType: 'entries' | 'exits',
  ) {
    const isEntriesUpdate = updateType === 'entries';
    isEntriesUpdate
      ? this.previousOptions.set(pageOptions)
      : this.nextOptions.set(pageOptions);
    const pages = isEntriesUpdate ? this.previousPages() : this.nextPages();

    const nextOrPreviousPage: PageFlowData =
      pages.length !== 0
        ? isEntriesUpdate
          ? pages[0]
          : pages[pages.length - 1]
        : this.focusPage();

    const value = nextOrPreviousPage.visits - pageOptions[0]?.total;
    const updatedLatestPage = { ...nextOrPreviousPage, [updateType]: value };

    if (pages.length === 0) {
      this.focusPage.set(updatedLatestPage);
      return;
    }

    const updatedPageArray = isEntriesUpdate
      ? [updatedLatestPage, ...pages.slice(1)]
      : [...pages.slice(0, -1), updatedLatestPage];

    const signalToUpdate = isEntriesUpdate
      ? this.previousPages
      : this.nextPages;

    signalToUpdate.set(updatedPageArray);
    this.setCurrentFlowData();
  }

  async resetPageFlowData(direction: Direction) {
    if (direction === 'next') {
      this.nextOptions.set([]);
      this.nextPages.set([]);
    } else if (direction === 'previous') {
      this.previousOptions.set([]);
      this.previousPages.set([]);
    }

    await this.getPageFlowData(direction);
  }

  async getPageFlowData(
    direction: Direction,
    limit = 5,
    urls = this.url() as string | string[],
  ) {
    this.isLoadingNext = direction === 'next' ? true : this.isLoadingNext;
    this.isLoadingPrevious =
      direction === 'previous' ? true : this.isLoadingPrevious;

    const params = {
      direction,
      limit,
      urls: JSON.stringify(urls),
      dateRange: JSON.stringify(this.dateRange()),
    };

    try {
      const data: PageFlowData[] = await firstValueFrom(
        this.http.get<PageFlowData[]>('/api/pages/flow', { params }),
      );

      if (direction === 'next') {
        this.updateEntriesOrExits(data, 'exits');
        this.isLoadingNext = false;
      } else if (direction === 'previous') {
        this.updateEntriesOrExits(data, 'entries');
        this.isLoadingPrevious = false;
      }
    } catch (error) {
      console.error('Failed to fetch page flow data', error);
      this.isLoadingNext = false;
      this.isLoadingPrevious = false;
    }
  }

  handleKeyDown(
    event: KeyboardEvent,
    direction: Direction,
    limit: number,
    item?: PageFlowData,
    rank?: number,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.pageClick(direction, limit, item, rank);
    }
  }

  handleKeyDownFlow(
    event: KeyboardEvent,
    item: PageFlowData,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.flowClick(item);
    }
  }
}
