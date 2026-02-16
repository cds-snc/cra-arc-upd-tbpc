import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nFacade } from '@dua-upd/upd/state';
import { EN_CA } from '@dua-upd/upd/i18n';
import { ProjectsDetailsFacade } from '../../+state/projects-details.facade';
import { globalColours } from '@dua-upd/utils-common';

@Component({
  selector: 'upd-tasks-tested',
  templateUrl: './tasks-tested.component.html',
  styleUrls: ['./tasks-tested.component.css'],
  standalone: false,
})
export class TasksTestedComponent {
  private i18n = inject(I18nFacade);
  private projectsDetailsService = inject(ProjectsDetailsFacade);

  currentLang = toSignal(this.i18n.currentLang$);
  tasksTestedData = toSignal(this.projectsDetailsService.tasksTestedData$);
  tasksTestedSummary = toSignal(this.projectsDetailsService.tasksTestedSummary$);

  langLink = computed(() => (this.currentLang() === EN_CA ? 'en' : 'fr'));

  hasData = computed(() => {
    const data = this.tasksTestedData();
    return data && data.length > 0;
  });

  readonly testTypeBarColors: Record<string, string> = {
    Baseline: globalColours[0],
    Validation: globalColours[1],
  };

  getBarColor(testType: string): string {
    return this.testTypeBarColors[testType] || globalColours[2];
  }

  formatTime(seconds: number | null): string {
    if (seconds == null) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m${secs.toString().padStart(2, '0')}s`;
  }
}
