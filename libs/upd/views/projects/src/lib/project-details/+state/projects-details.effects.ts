import { inject, Injectable } from '@angular/core';
import { createEffect, Actions, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { catchError, EMPTY, mergeMap, map, of, filter } from 'rxjs';
import * as ProjectsDetailsActions from './projects-details.actions';
import { ApiService } from '@dua-upd/upd/services';
import { Store } from '@ngrx/store';
import {
  selectDatePeriod,
  selectDateRanges,
  selectRouteNestedParam,
  selectRoute,
} from '@dua-upd/upd/state';
import { selectProjectsDetailsData } from './projects-details.selectors';
import { loadProjectsDetailsSuccess } from './projects-details.actions';

const projectsRouteRegex = /\/projects\//;

@Injectable()
export class ProjectsDetailsEffects {
  private readonly actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(ApiService);

  init$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ProjectsDetailsActions.loadProjectsDetailsInit),
      concatLatestFrom(() => [
        this.store.select(selectRouteNestedParam('id')),
        this.store.select(selectDateRanges),
        this.store.select(selectProjectsDetailsData),
      ]),
      filter(([, projectId]) => !!projectId),
      mergeMap(
        ([
          ,
          projectId,
          { dateRange, comparisonDateRange },
          projectDetailsData,
        ]) => {
          if (!projectId) {
            console.error('projectId not found when trying to load page details');
          }

          const projectIsLoaded = projectDetailsData._id === projectId; // page is already loaded (but not necessarily with the correct data)
          const dateRangeIsLoaded = projectDetailsData.dateRange === dateRange; // data for the dateRange is already loaded
          const comparisonDateRangeIsLoaded =
            projectDetailsData.comparisonDateRange === comparisonDateRange;

          if (
            projectIsLoaded &&
            dateRangeIsLoaded &&
            comparisonDateRangeIsLoaded
          ) {
            // if everything is already loaded in the state, don't update it
            return of(loadProjectsDetailsSuccess({ data: null }));
          }

          return this.api
            .getProjectsDetailsData({
              id: projectId,
              dateRange,
              ...{ comparisonDateRange },
            })
            .pipe(
              map((data) => loadProjectsDetailsSuccess({ data })),
              catchError(() => EMPTY),
            );
        },
      ),
    );
  });

  dateChange$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(selectDatePeriod),
      concatLatestFrom(() => this.store.select(selectRoute)),
      filter(([, route]) => projectsRouteRegex.test(route)),
      mergeMap(() => of(ProjectsDetailsActions.loadProjectsDetailsInit())),
    );
  });
}
