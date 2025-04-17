import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CustomReportsComponent } from './custom-reports.component';
import { CustomReportsCreateComponent } from './create/custom-reports-create.component';
import { CustomReportsReportComponent } from './report/custom-reports-report.component';
import { CustomReportsFeedbackReportComponent } from './feedback-report/custom-reports-feedback-report.component';

@NgModule({
  imports: [
    CustomReportsComponent,
    RouterModule.forChild([
      {
        path: '',
        component: CustomReportsComponent,
        children: [
          { path: '', redirectTo: 'create', pathMatch: 'full' },
          {
            path: 'create',
            component: CustomReportsCreateComponent,
            data: { title: 'Custom reports | Create' },
          },
          {
            path: 'feedback',
            component: CustomReportsFeedbackReportComponent,
            data: { title: 'Custom reports | Page feedback report' },
          },
          {
            path: ':id',
            component: CustomReportsReportComponent,
            data: { title: 'Custom reports | Report' },
          },
          { path: '**', redirectTo: 'create', pathMatch: 'full' },
        ],
      },
    ]),
  ],
  exports: [RouterModule],
})
export class CustomReportsModule {}
