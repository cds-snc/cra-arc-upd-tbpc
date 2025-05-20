import { CommonModule, ViewportScroller } from '@angular/common';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  ViewEncapsulation,
  WritableSignal,
  inject,
  signal,
  Signal,
  computed,
  effect,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nFacade } from '@dua-upd/upd/state';
import { TranslateModule } from '@ngx-translate/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ApiService } from '@dua-upd/upd/services';
import { I18nModule } from '@dua-upd/upd/i18n';
import {
  DataTableComponent,
  AccordionComponent,
  CalendarComponent,
  UpdComponentsModule,
  type DropdownOption,
} from '@dua-upd/upd-components';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import {
  type AADimensionName,
  type AAMetricName,
  type AAQueryDateStart,
  type AAQueryDateEnd,
  type ColumnConfig,
  type ReportCreateResponse,
  type ReportConfig,
  type ReportGranularity,
  type ReportFeedbackConfig,
  FeedbackSelectionData,
} from '@dua-upd/types-common';

dayjs.extend(utc);
dayjs.extend(timezone);

type PageSelectionData = {
  pages: { _id: string; url: string; title: string }[];
  tasks: { _id: string; title: string; pages: string[] }[];
  projects: { _id: string; title: string; pages: string[] }[];
};

interface QueryParams {
  start: string;
  end: string;
  pages?: string;
  tasks?: string;
  projects?: string;
}

@Component({
    selector: 'dua-upd-custom-reports-create',
    imports: [
        CommonModule,
        UpdComponentsModule,
        TranslateModule,
        ClipboardModule,
        I18nModule,
        NgbTooltipModule,
    ],
    templateUrl: './custom-reports-create.component.html',
    styleUrls: ['./custom-reports-create.component.scss'],
    providers: [ApiService, I18nFacade],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
})
export class CustomReportsCreateComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private zone: NgZone = inject(NgZone);
  private i18n = inject(I18nFacade);
  private scroller = inject(ViewportScroller);
  private readonly api = inject(ApiService);

  successUrls = true;
  dangerUrls = true;
  warningUrls = true;
  successFeedbackData = true;
  dangerFeedbackData = true;
  warningFeedbackData = true;
  overviewError = true;
  overviewFeedbackError = true;

  lang = this.i18n.currentLang;

  storageConfig: ReportConfig | null =
    history.state['config'] ||
    JSON.parse(sessionStorage.getItem('custom-reports-config') || 'null');

  storageFeedbackConfig: ReportFeedbackConfig | null =
    history.state['feedbackConfig'] ||
    JSON.parse(
      sessionStorage.getItem('custom-reports-feedback-config') || 'null',
    );

  storageTab: number | null =
    history.state['activeTab'] ||
    Number(sessionStorage.getItem('custom-reports-active-tab')) ||
    'null';

  activeTab = signal<number>(this.storageTab || 0);

  // get required data from the api
  selectionData: Signal<PageSelectionData | null> = toSignal(
    this.api.queryDb({
      pages: {
        collection: 'pages',
        filter: {},
        project: { url: 1, title: 1 },
      },
      tasks: {
        collection: 'tasks',
        filter: { pages: { $exists: true, $not: { $size: 0 } } },
        project: { title: 1, pages: 1 },
        sort: { title: 1 },
      },
      projects: {
        collection: 'projects',
        filter: { pages: { $exists: true, $not: { $size: 0 } } },
        project: { title: 1, pages: 1 },
        sort: { title: 1 },
      },
    }),
    {
      initialValue: null,
    },
  );

  pages = computed(() => this.selectionData()?.pages || []);
  tasks = computed(() => this.selectionData()?.tasks || []);
  projects = computed(() => this.selectionData()?.projects || []);
  pagesMap = computed(
    () => new Map(this.pages().map((page) => [page._id, page])),
  );

  validationTriggered = false;
  validationFeedbackTriggered = false;

  error: WritableSignal<string | null> = signal(null);
  errorFeedback: WritableSignal<string | null> = signal(null);

  calendarDateFormat = computed(() =>
    this.lang() === 'en-CA' ? 'M dd yy' : 'dd M yy',
  );

  dateRange = signal({
    start: this.storageConfig?.dateRange.start || '',
    end: this.storageConfig?.dateRange.end || '',
  });

  dateRangeFeedback = signal({
    start: this.storageFeedbackConfig?.dateRange.start || '',
    end: this.storageFeedbackConfig?.dateRange.end || '',
  });

  selectedReportMetrics = signal<AAMetricName[]>(
    this.storageConfig?.metrics || [],
  );

  selectedReportDimensions = signal<string>(
    this.storageConfig?.breakdownDimension || '',
  );

  isGrouped = signal(this.storageConfig?.grouped || false);

  readonly granularityOptions: DropdownOption<ReportGranularity>[] = [
    { label: 'None', value: 'none' },
    { label: 'Daily', value: 'day' },
    { label: 'Weekly', value: 'week' },
    { label: 'Monthly', value: 'month' },
  ];

  selectedGranularity = signal<ReportGranularity>(
    this.storageConfig?.granularity || 'none',
  );

  reportUrls = signal<string[]>(this.storageConfig?.urls || []);

  config = computed<ReportConfig>(() => ({
    dateRange: this.dateRange(),
    granularity: this.selectedGranularity(),
    urls: this.reportUrls(),
    grouped: this.isGrouped(),
    metrics: this.selectedReportMetrics(),
    breakdownDimension: this.selectedReportDimensions() as AADimensionName,
  }));

  feedbackConfig = computed<ReportFeedbackConfig>(() => ({
    dateRange: this.dateRangeFeedback(),
    pages: this.pagesFeedbackData(),
    tasks: this.tasksFeedbackData(),
    projects: this.projectsFeedbackData(),
  }));

  @ViewChild('dataTable') dataTableComponent!: DataTableComponent<
    PageSelectionData['pages']
  >;
  @ViewChild('tasksTable') tasksTableComponent!: DataTableComponent<
    PageSelectionData['tasks']
  >;
  @ViewChild('projectsTable') projectsTableComponent!: DataTableComponent<
    PageSelectionData['projects']
  >;
  @ViewChild('urlTextarea') urlTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('urlsAdded') accordionComponent!: AccordionComponent;

  @ViewChild('dataTable2') dataTableComponent2!: DataTableComponent<
    PageSelectionData['pages']
  >;
  @ViewChild('tasksTable2') tasksTableComponent2!: DataTableComponent<
    PageSelectionData['tasks']
  >;
  @ViewChild('projectsTable2') projectsTableComponent2!: DataTableComponent<
    PageSelectionData['projects']
  >;
  @ViewChild('urlTextarea2') urlTextarea2!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('urlsAdded2') accordionComponent2!: AccordionComponent;
  @ViewChild('calendar') calendarComponent!: CalendarComponent;
  @ViewChild('calendar2') calendarComponent2!: CalendarComponent;

  titleCol = this.i18n.service.translationSignal('Title', (title) => ({
    field: 'title' as const,
    header: title(),
    translate: true,
  }));

  urlCol = this.i18n.service.translationSignal('URL', (url) => ({
    field: 'url' as const,
    header: url(),
  }));

  columns: Signal<ColumnConfig<{ _id: string; url: string; title: string }>[]> =
    computed(() => [this.titleCol(), this.urlCol()]);

  taskColumns: Signal<
    ColumnConfig<{ _id: string; title: string; pages: string[] }>[]
  > = computed(() => [this.titleCol()]);

  searchFields = computed(() => this.columns().map((col) => col.field));

  validUrls = computed<string[]>(() => this.pages()?.map((p) => p.url) || []);

  validPages = computed<FeedbackSelectionData[]>(() =>
    this.pages().map(
      (page) =>
        ({
          _id: page._id,
          title: page.title,
        }) as FeedbackSelectionData,
    ),
  );

  validTasks = computed<FeedbackSelectionData[]>(() =>
    this.tasks().map(
      (task) =>
        ({
          _id: task._id,
          title: this.i18n.service.translate(task.title, this.lang()),
          pages: task.pages,
        }) as FeedbackSelectionData,
    ),
  );

  validProjects = computed<FeedbackSelectionData[]>(() =>
    this.projects().map(
      (project) =>
        ({
          _id: project._id,
          title: this.i18n.service.translate(project.title, this.lang()),
          pages: project.pages,
        }) as FeedbackSelectionData,
    ),
  );

  duplicateUrls = signal<string[]>([]);
  invalidUrls = signal<string[]>([]);
  newUrls = signal<string[]>([]);

  duplicateFeedbackPages = signal<FeedbackSelectionData[]>([]);
  duplicateFeedbackTasks = signal<FeedbackSelectionData[]>([]);
  duplicateFeedbackProjects = signal<FeedbackSelectionData[]>([]);
  invalidFeedbackData = signal<FeedbackSelectionData[]>([]);
  newFeedbackPages = signal<FeedbackSelectionData[]>([]);
  newFeedbackTasks = signal<FeedbackSelectionData[]>([]);
  newFeedbackProjects = signal<FeedbackSelectionData[]>([]);

  selectedPages = signal<PageSelectionData['pages']>([]);
  selectedTasks = signal<PageSelectionData['tasks']>([]);
  selectedProjects = signal<PageSelectionData['projects']>([]);

  pagesFeedbackData = signal<FeedbackSelectionData[]>(
    this.storageFeedbackConfig?.pages || [],
  );
  tasksFeedbackData = signal<FeedbackSelectionData[]>(
    this.storageFeedbackConfig?.tasks || [],
  );
  projectsFeedbackData = signal<FeedbackSelectionData[]>(
    this.storageFeedbackConfig?.projects || [],
  );

  combinedSelectedUrls = computed(() => {
    const selectedPageUrls = this.selectedPages().map((page) => page.url);

    const selectedTaskIds = this.selectedTasks().flatMap((task) => task.pages);

    const selectedProjectIds = this.selectedProjects().flatMap(
      (project) => project.pages,
    );

    const pageIds = new Set(selectedTaskIds.concat(selectedProjectIds));

    const combinedUrls = new Set(selectedPageUrls);

    const pagesMap = this.pagesMap();

    const reportUrls = this.reportUrls();

    for (const id of pageIds) {
      const page = pagesMap.get(id);

      if (!page) {
        // should probably change this to throw an error, seeing as these ids *should* always be valid
        console.error(`Page with id ${id} not found`);
        continue;
      }

      // pre-filter urls that are already included
      if (reportUrls.includes(page.url)) continue;

      combinedUrls.add(page.url);
    }

    return combinedUrls;
  });

  showCopyAlert = false;

  reportMetrics = [
    {
      label: 'Visits',
      value: 'visits',
      description: 'tooltip-visits-cb',
    },
    {
      label: 'Page views',
      value: 'views',
      description: 'tooltip-views-cb',
    },
    {
      label: 'Visitors',
      value: 'visitors',
      description: 'tooltip-visitors-cb',
    },
    {
      label: 'Average time spent',
      value: 'average_time_spent',
      description: 'tooltip-avgtime-cb',
    },
    {
      label: 'Bounce rate',
      value: 'bouncerate',
      description: 'tooltip-bounce-cb',
    },
    // {
    //   label: 'Navigation menu initiated',
    //   value: 'nav_menu_initiated',
    //   description: 'The number of times the navigation menu was opened',
    // },
    {
      label: '"Did you find what you were looking for?" - Submit',
      value: 'dyf_submit',
      description: 'tooltip-dyfsubmit-cb',
    },
    {
      label: '"Did you find what you were looking for?" - Yes',
      value: 'dyf_yes',
      description: 'tooltip-dyfyes-cb',
    },
    {
      label: '"Did you find what you were looking for?" - No',
      value: 'dyf_no',
      description: 'tooltip-dyfno-cb',
    },
  ];

  reportDimensions = [
    { label: 'None', value: '', description: 'tooltip-none-rb' },
    {
      label: 'Device type',
      value: 'device_type',
      description: 'tooltip-device-rb',
    },
    { label: 'Regions', value: 'region', description: 'tooltip-regions-rb' },
    { label: 'Cities', value: 'city', description: 'tooltip-cities-rb' },
    {
      label: 'Countries',
      value: 'country',
      description: 'tooltip-countries-rb',
    },
    {
      label: 'Referrer',
      value: 'referrer',
      description: 'tooltip-referrer-rb',
    },
    {
      label: 'Referrer type',
      value: 'referrer_type',
      description: 'tooltip-referrertype-rb',
    },
    {
      label: 'Previous page',
      value: 'prev_page',
      description: 'tooltip-prevpage-rb',
    },
    {
      label: 'Time spent',
      value: 'time_spent',
      description: 'tooltip-timespent-rb',
    },
  ];

  constructor() {
    const initialGranularity = this.selectedGranularity();
    let granularityChanged = false;

    effect(
      () => {
        const granularity = this.selectedGranularity();

        // resetCalendar was firing on initial load, so we need to check if the granularity actually changed
        if (!granularityChanged && initialGranularity !== granularity) {
          granularityChanged = true;
        }

        if (granularityChanged) {
          this.calendarComponent?.resetCalendar();
        }
      }
    );

    effect(() => {
      sessionStorage.setItem(
        'custom-reports-config',
        JSON.stringify(this.config()),
      );
    });

    effect(() => {
      sessionStorage.setItem(
        'custom-reports-feedback-config',
        JSON.stringify(this.feedbackConfig()),
      );
    });

    effect(() => {
      sessionStorage.setItem(
        'custom-reports-active-tab',
        this.activeTab().toString(),
      );
    });
  }

  stateDimension =
    this.reportDimensions.find(
      (d) => d.value === this.storageConfig?.breakdownDimension,
    ) || this.reportDimensions[0];
  stateMetrics: string[] = this.storageConfig?.metrics || [];
  stateCalendarDates?: Date[] =
    this.storageConfig?.dateRange &&
    dateRangeToCalendarDates(this.storageConfig.dateRange);

  stateFeedbackCalendarDates?: Date[] =
    this.storageFeedbackConfig?.dateRange &&
    dateRangeToCalendarDates(this.storageFeedbackConfig.dateRange);

  copyToClipboard() {
    this.showCopyAlert = !this.showCopyAlert;
  }

  addPages(inputValue: string) {
    const reportUrls = this.reportUrls();

    const parsedUrls = inputValue
      .split(/[\n,;]+/)
      .map((url) => url.trim().replace(/^https?:\/\//, ''))
      .filter((url) => url.length > 0);

    const validNewUrls = new Set<string>();
    const invalidUrls: string[] = [];
    const duplicateUrls: string[] = [];

    const validUrls = this.validUrls();

    for (const url of [...parsedUrls, ...this.combinedSelectedUrls()]) {
      if (reportUrls.includes(url)) {
        duplicateUrls.push(url);
        continue;
      }

      if (validUrls.includes(url) && !reportUrls.includes(url)) {
        validNewUrls.add(url);
        continue;
      }

      invalidUrls.push(url);
    }

    this.invalidUrls.set(invalidUrls);
    this.duplicateUrls.set(duplicateUrls);
    this.newUrls.set(Array.from(validNewUrls));
    this.reportUrls.update((urls) => [...urls, ...validNewUrls]);
  }

  addPagesFeedback(inputValue: string) {
    const pagesFeedbackData = this.pagesFeedbackData();
    const tasksFeedbackData = this.tasksFeedbackData();
    const projectsFeedbackData = this.projectsFeedbackData();

    const parsedUrls = inputValue
      .split(/[\n,;]+/)
      .map((url) => url.trim().replace(/^https?:\/\//, ''))
      .filter((url) => url.length > 0);

    const pagesFromParsedUrls = parsedUrls
      .map((url) => {
        const page = this.pages().find((page) => page.url === url);
        return page
          ? ({ _id: page._id, title: page.title } as FeedbackSelectionData)
          : url;
      })
      .filter((page): page is FeedbackSelectionData => page !== undefined);

    const feedbackPages: FeedbackSelectionData[] = [];
    const validNewFeedbackTasks: FeedbackSelectionData[] = [];
    const validNewFeedbackProjects: FeedbackSelectionData[] = [];

    const invalidFeedbackData: FeedbackSelectionData[] = [];
    const duplicateFeedbackPages: FeedbackSelectionData[] = [];
    const duplicateFeedbackTasks: FeedbackSelectionData[] = [];
    const duplicateFeedbackProjects: FeedbackSelectionData[] = [];

    const pages = this.selectedPages().map(
      (page) =>
        ({
          _id: page._id,
          title: page.title,
        }) as FeedbackSelectionData,
    );

    const tasks = this.selectedTasks().map(
      (task) =>
        ({
          _id: task._id,
          title: task.title,
          pages: task.pages,
        }) as FeedbackSelectionData,
    );

    const projects = this.selectedProjects().map(
      (project) =>
        ({
          _id: project._id,
          title: project.title,
          pages: project.pages,
        }) as FeedbackSelectionData,
    );

    for (const page of [...pagesFromParsedUrls, ...pages]) {
      if (this.exists(pagesFeedbackData, page)) {
        duplicateFeedbackPages.push(page);
        continue;
      }

      if (
        this.exists(this.validPages(), page) &&
        !this.exists(pagesFeedbackData, page)
      ) {
        feedbackPages.push(page);
        continue;
      }

      invalidFeedbackData.push(page);
    }

    for (const task of tasks) {
      if (this.exists(tasksFeedbackData, task)) {
        duplicateFeedbackTasks.push(task);
        continue;
      }

      if (
        this.exists(this.validTasks(), task) &&
        !this.exists(tasksFeedbackData, task)
      ) {
        validNewFeedbackTasks.push(task);
        continue;
      }

      invalidFeedbackData.push(task);
    }

    for (const project of projects) {
      if (this.exists(projectsFeedbackData, project)) {
        duplicateFeedbackProjects.push(project);
        continue;
      }

      if (
        this.exists(this.validProjects(), project) &&
        !this.exists(projectsFeedbackData, project)
      ) {
        validNewFeedbackProjects.push(project);
        continue;
      }

      invalidFeedbackData.push(project);
    }

    const validNewFeedbackPages = feedbackPages.filter(
      (page, i, self) => i === self.findIndex((p) => p._id === page._id),
    );

    this.invalidFeedbackData.set(invalidFeedbackData);
    this.duplicateFeedbackPages.set(duplicateFeedbackPages);
    this.newFeedbackPages.set(validNewFeedbackPages);
    this.duplicateFeedbackTasks.set(duplicateFeedbackTasks);
    this.newFeedbackTasks.set(validNewFeedbackTasks);
    this.duplicateFeedbackProjects.set(duplicateFeedbackProjects);
    this.newFeedbackProjects.set(validNewFeedbackProjects);

    this.pagesFeedbackData.update((pages) => [
      ...pages,
      ...validNewFeedbackPages,
    ]);
    this.tasksFeedbackData.update((tasks) => [
      ...tasks,
      ...validNewFeedbackTasks,
    ]);
    this.projectsFeedbackData.update((projects) => [
      ...projects,
      ...validNewFeedbackProjects,
    ]);
  }

  exists(data: FeedbackSelectionData[], target: FeedbackSelectionData) {
    return data.some(
      (page) => page._id === target._id && page.title === target.title,
    );
  }

  removePage(index: number) {
    this.reportUrls.update((urls) => {
      urls.splice(index, 1);

      return [...urls];
    });
  }

  removeFeedbackPage(index: number) {
    this.pagesFeedbackData.update((pages) => {
      pages.splice(index, 1);

      return [...pages];
    });
  }

  removeFeedbackTask(index: number) {
    this.tasksFeedbackData.update((tasks) => {
      tasks.splice(index, 1);

      return [...tasks];
    });
  }

  removeFeedbackProject(index: number) {
    this.projectsFeedbackData.update((projects) => {
      projects.splice(index, 1);

      return [...projects];
    });
  }

  resetUrls() {
    this.reportUrls.set([]);
  }

  resetPagesTasksProjects() {
    this.pagesFeedbackData.set([]);
    this.tasksFeedbackData.set([]);
    this.projectsFeedbackData.set([]);
  }

  resetCalendar(): void {
    this.calendarComponent?.resetCalendar();
  }

  resetTableSelection() {
    this.dataTableComponent.clearSelections();
    this.tasksTableComponent.clearSelections();
    this.projectsTableComponent.clearSelections();
    this.urlTextarea.nativeElement.value = '';
  }

  resetFeedbackTableSelection() {
    this.dataTableComponent2.clearSelections();
    this.tasksTableComponent2.clearSelections();
    this.projectsTableComponent2.clearSelections();
    this.urlTextarea2.nativeElement.value = '';
  }

  handleDateChange(date: Date | Date[]) {
    if (!Array.isArray(date) || date.length === 0) {
      this.dateRange.set({
        start: '',
        end: '',
      });

      return;
    }

    if (date.length !== 0) {
      const [startDate, endDate] = date;

      // make sure the timezone offset is correct
      this.dateRange.set({
        start: dayjs(startDate).format(
          'YYYY-MM-DDT00:00:00.000[Z]',
        ) as AAQueryDateStart,
        end: dayjs(endDate || startDate).format(
          'YYYY-MM-DDT23:59:59.999[Z]',
        ) as AAQueryDateEnd,
      });
    }
  }

  handleFeedbackDateChange(date: Date | Date[]) {
    if (!Array.isArray(date) || date.length === 0) {
      this.dateRangeFeedback.set({
        start: '',
        end: '',
      });

      return;
    }

    if (date.length !== 0) {
      const [startDate, endDate] = date;

      // make sure the timezone offset is correct
      this.dateRangeFeedback.set({
        start: dayjs(startDate).format('YYYY-MM-DDT00:00:00.000[Z]'),
        end: dayjs(endDate || startDate).format('YYYY-MM-DDT23:59:59.999[Z]'),
      });
    }
  }

  selectPages(pages: PageSelectionData['pages']) {
    this.selectedPages.set(pages);
  }

  selectTasks(tasks: PageSelectionData['tasks']) {
    this.selectedTasks.set(tasks);
  }

  selectProjects(tasks: PageSelectionData['projects']) {
    this.selectedProjects.set(tasks);
  }

  selectDimension(dimension: string) {
    this.selectedReportDimensions.set(dimension);
  }

  selectGranularity(granularity: 'day' | 'week' | 'month' | 'none' | null) {
    this.selectedGranularity.set(granularity as ReportGranularity);
  }

  selectMetrics(metrics: string[]) {
    // not typesafe: ensure the values passed to checkboxes are valid
    this.selectedReportMetrics.set(metrics as AAMetricName[]);
  }

  setIsGrouped(isGrouped: boolean) {
    this.isGrouped.set(isGrouped);
  }

  get isAccordionExpanded(): boolean {
    return this.reportUrls().length < 10;
  }

  openLink(event: MouseEvent, link: string) {
    if (event.ctrlKey) {
      window.open(link, '_blank');
    } else {
      event.preventDefault();
    }
  }

  isDateRangeValid(): boolean {
    const config = this.config();

    const startDate = dayjs.utc(config.dateRange.start);
    const endDate = dayjs.utc(config.dateRange.end);

    return (
      !!config.dateRange.start &&
      !!config.dateRange.end &&
      startDate.isBefore(dayjs.utc().startOf('day')) &&
      endDate.isAfter(startDate)
    );
  }

  isFeedbackDateRangeValid(): boolean {
    const config = this.feedbackConfig();

    const startDate = dayjs.utc(config.dateRange.start);
    const endDate = dayjs.utc(config.dateRange.end);

    return (
      !!config.dateRange.start &&
      !!config.dateRange.end &&
      startDate.isBefore(dayjs.utc().startOf('day')) &&
      endDate.isAfter(startDate)
    );
  }

  areUrlsValid(): boolean {
    return this.config().urls?.length > 0;
  }

  areMetricsValid(): boolean {
    return this.config().metrics?.length > 0;
  }

  arePagesTasksProjectsValid(): boolean {
    return (
      this.feedbackConfig().pages?.length > 0 ||
      this.feedbackConfig().tasks?.length > 0 ||
      this.feedbackConfig().projects?.length > 0
    );
  }

  resetValidation() {
    if (this.validationTriggered) {
      this.validationTriggered = false;
    }
  }

  resetFeedbackValidation() {
    if (this.validationFeedbackTriggered) {
      this.validationFeedbackTriggered = false;
    }
  }

  scrollToAnchor(link: string) {
    this.scroller.scrollToAnchor(link);
  }

  async createReport(config: ReportConfig) {
    if (
      !this.isDateRangeValid() ||
      !this.areUrlsValid() ||
      !this.areMetricsValid()
    ) {
      this.validationTriggered = true;
      this.overviewError = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const res: ReportCreateResponse = await fetch(
      '/api/custom-reports/create',
      {
        method: 'POST',
        body: JSON.stringify(config),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ).then((res) => res.json());

    if ('error' in res) {
      this.error.set(res.error);

      return;
    }

    await this.zone.run(() =>
      this.router.navigate(['../', res._id], { relativeTo: this.route }),
    );
  }

  async createFeedbackReport(config: ReportFeedbackConfig) {
    if (
      !this.isFeedbackDateRangeValid() ||
      !this.arePagesTasksProjectsValid()
    ) {
      this.validationFeedbackTriggered = true;
      this.overviewFeedbackError = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const dateRangeStart = config.dateRange.start;
    const dateRangeEnd = config.dateRange.end;
    const pageIds = config.pages.map((page) => page._id);
    const taskIds = config.tasks.map((task) => task._id);
    const projectIds = config.projects.map((project) => project._id);

    const queryParams: QueryParams = {
      start: dateRangeStart.slice(0, 10),
      end: dateRangeEnd.slice(0, 10),
    };

    if (pageIds.length > 0) {
      queryParams.pages = pageIds.join('-');
    }

    if (taskIds.length > 0) {
      queryParams.tasks = taskIds.join('-');
    }

    if (projectIds.length > 0) {
      queryParams.projects = projectIds.join('-');
    }

    this.router.navigate(['../feedback'], {
      relativeTo: this.route,
      queryParams,
    });
  }
}

function dateRangeToCalendarDates(
  dateRange: ReportConfig['dateRange'] | ReportFeedbackConfig['dateRange'],
): Date[] {
  const dates: Date[] = [];

  if (dateRange.start) {
    const newStartDate = dayjs(dateRange.start.slice(0, 10))
      .tz(dayjs.tz.guess(), true)
      .toDate();

    dates.push(newStartDate);
  }

  if (dateRange.end) {
    const newEndDate = dayjs(dateRange.end.slice(0, 10))
      .tz(dayjs.tz.guess(), true)
      .toDate();

    dates.push(newEndDate);
  }

  return dates;
}
