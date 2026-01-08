import { Component, inject, OnInit } from '@angular/core';
import { ReportsFacade } from './+state/reports.facade';

@Component({
    selector: 'upd-reports',
    templateUrl: './reports.component.html',
    styleUrls: ['./reports.component.scss'],
    standalone: false
})
export class ReportsComponent implements OnInit {
  private readonly reportsService = inject(ReportsFacade);

  tasksReports$ = this.reportsService.tasksReports$;
  tasksReportsColumns$ = this.reportsService.tasksReportsColumns$;

  projectsReports$ = this.reportsService.projectsReports$;
  projectsReportsColumns$ = this.reportsService.projectsReportsColumns$;

  error$ = this.reportsService.error$;


  ngOnInit() {
    this.reportsService.init();
  }
}
