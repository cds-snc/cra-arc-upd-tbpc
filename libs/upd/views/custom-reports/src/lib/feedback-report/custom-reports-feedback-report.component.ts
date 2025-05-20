import {
  Component,
  computed,
  inject,
  Signal,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@dua-upd/upd/services';
import { toSignal } from '@angular/core/rxjs-interop';
import { Types } from 'mongoose';
import type {
  ColumnConfig,
  CustomReportsFeedback,
} from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { UpdComponentsModule } from '@dua-upd/upd-components';
import { I18nModule } from '@dua-upd/upd/i18n';
import { catchError, of } from 'rxjs';

@Component({
    selector: 'dua-upd-custom-reports-feedback-report',
    imports: [CommonModule, I18nModule, UpdComponentsModule],
    templateUrl: './custom-reports-feedback-report.component.html',
    styleUrl: './custom-reports-feedback-report.component.scss',
    providers: [ApiService, I18nFacade]
})
export class CustomReportsFeedbackReportComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly api = inject(ApiService);

  queryParams = toSignal(this.route.queryParamMap);

  startDate = computed(() => this.queryParams()?.get('start') || '');

  endDate = computed(() => this.queryParams()?.get('end') || '');

  pages = computed(() => {
    const param = this.queryParams()?.get('pages');

    if (param) {
      const pages = param.split('-');
      return pages.map((page) => new Types.ObjectId(page));
    }

    return [];
  });

  tasks = computed(() => {
    const param = this.queryParams()?.get('tasks');

    if (param) {
      const tasks = param.split('-');
      return tasks.map((task) => new Types.ObjectId(task));
    }

    return [];
  });

  projects = computed(() => {
    const param = this.queryParams()?.get('projects');

    if (param) {
      const projects = param.split('-');
      return projects.map((project) => new Types.ObjectId(project));
    }

    return [];
  });

  error = signal<string | ''>('');

  queryResults: Signal<{ feedback: CustomReportsFeedback } | null> = toSignal(
    this.api
      .queryDb<{ feedback: CustomReportsFeedback }>({
        feedback: {
          collection: 'feedback',
          filter: {
            date: {
              $gte: new Date(this.startDate()),
              $lte: new Date(this.endDate()),
            },
            page: this.pages(),
            tasks: this.tasks(),
            projects: this.projects(),
          },
        },
      })
      .pipe(
        catchError((err) => {
          this.error.set('feedback-report-error');
          return of(null);
        }),
      ),
    {
      initialValue: null,
    },
  );

  commentsData = computed(() => {
    const comments =
      this.queryResults()?.feedback.comments.map((c) => ({
        date: c.date,
        url: c.url,
        comment: c.comment,
        taskTitles: c.taskTitles.join(', '),
        projectTitles: c.projectTitles.join(', '),
      })) || [];

    return comments.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  });

  selectedPages = computed(() => this.queryResults()?.feedback.selectedPages);

  selectedTasks = computed(() => this.queryResults()?.feedback.selectedTasks);

  selectedProjects = computed(
    () => this.queryResults()?.feedback.selectedProjects,
  );

  selectedPagesCount = computed(() => this.selectedPages()?.length || 0);

  selectedTasksCount = computed(() => this.selectedTasks()?.length || 0);

  selectedProjectsCount = computed(() => this.selectedProjects()?.length || 0);

  selectedCount = computed(
    () =>
      this.selectedPagesCount() +
      this.selectedTasksCount() +
      this.selectedProjectsCount(),
  );

  columnsComments: ColumnConfig<{
    date: Date;
    url: string;
    comment: string;
    taskTitles: string;
    projectTitles: string;
  }>[] = [
    {
      field: 'date',
      header: 'date',
      pipe: 'date',
      translate: true,
    },
    {
      field: 'url',
      header: 'url',
    },
    {
      field: 'comment',
      header: 'comment',
    },
    {
      field: 'taskTitles',
      header: 'tasks',
      translate: true,
    },
    {
      field: 'projectTitles',
      header: 'ux-projects',
      translate: true,
    },
  ];

  goBack() {
    this.router.navigate(['../create'], {
      relativeTo: this.route,
    });
  }

  ngOnInit() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
