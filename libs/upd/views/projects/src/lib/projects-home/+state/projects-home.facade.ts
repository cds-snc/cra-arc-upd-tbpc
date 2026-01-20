import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as ProjectsHomeActions from './projects-home.actions';
import * as ProjectsHomeSelectors from './projects-home.selectors';
import { combineLatest, map } from 'rxjs';
import dayjs from 'dayjs/esm';
import utc from 'dayjs/esm/plugin/utc';
import 'dayjs/esm/locale/en-ca';
import 'dayjs/esm/locale/fr-ca';
import { I18nFacade } from '@dua-upd/upd/state';

dayjs.extend(utc);

@Injectable()
export class ProjectsHomeFacade {
  private i18n = inject(I18nFacade);
  private readonly store = inject(Store);

  currentLang$ = this.i18n.currentLang$;

  loaded$ = this.store.select(ProjectsHomeSelectors.selectProjectsHomeLoaded);

  projectsHomeData$ = this.store.select(
    ProjectsHomeSelectors.selectProjectsHomeData,
  );

  projectsHomeTableData$ = combineLatest([
    this.projectsHomeData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const projectsHome = data?.projects?.map((d) => ({
        ...d,
        title: d.title
          ? this.i18n.service.translate(d.title.replace(/\s+/g, ' '), lang)
          : '',
        cops: !!d.cops,
        wos_cops: !!d.wos_cops,
        // projectTypeLabel: d.cops && d.wos_cops
        //     ? 'COPS + WOS_COPS'
        //     : d.cops
        //       ? 'COPS'
        //       : d.wos_cops
        //         ? 'WOS_COPS'
        //         : null,
        projectTypeLabel: [
          ...(d.cops ? ['COPS'] : []),
          ...(d.wos_cops ? ['WOS_COPS'] : []),
        ],            
        startDate: d.startDate || '',
      }));

      return [...(projectsHome || [])];
    }),
  );

  numInProgress$ = this.projectsHomeData$.pipe(
    map((data) => data?.numInProgress),
  );
  numPlanning$ = this.projectsHomeData$.pipe(map((data) => data?.numPlanning));
  numCompletedLast6Months$ = this.projectsHomeData$.pipe(
    map((data) => data?.numCompletedLast6Months),
  );
  totalCompleted$ = this.projectsHomeData$.pipe(
    map((data) => data?.totalCompleted),
  );
  numDelayed$ = this.projectsHomeData$.pipe(map((data) => data?.numDelayed));
  completedCOPS$ = this.projectsHomeData$.pipe(
    map((data) => data?.completedCOPS),
  );
  error$ = this.store.select(ProjectsHomeSelectors.selectProjectsHomeError);

  init() {
    this.store.dispatch(ProjectsHomeActions.loadProjectsHomeInit());
  }
}
