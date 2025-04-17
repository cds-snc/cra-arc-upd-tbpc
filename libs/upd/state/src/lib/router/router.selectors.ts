import { Params } from '@angular/router';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { RouterReducerState, getRouterSelectors } from '@ngrx/router-store';

export const selectRouter = createFeatureSelector<RouterReducerState>('router');

export const {
  selectCurrentRoute,   // select the current route
  selectFragment,       // select the current route fragment
  selectQueryParams,    // select the current route query params
  selectQueryParam,     // factory function to select a query param
  selectRouteParams,    // select the current route params
  selectRouteParam,     // factory function to select a route param
  selectRouteData,      // select the current route data
  selectUrl,            // select the current url
} = getRouterSelectors(selectRouter);

export const selectRoute = createSelector(selectUrl, (url) =>
  url?.replace(/\?.+$/, ''),
);

export const selectRouteNestedParams = createSelector(
  selectRouter,
  (router) => {
    let currentRoute = router?.state?.root;
    let params: Params = {};
    while (currentRoute?.firstChild) {
      currentRoute = currentRoute.firstChild;
      params = {
        ...params,
        ...currentRoute.params,
      };
    }
    return params;
  },
);

export const selectRouteNestedParam = (param: string) =>
  createSelector(selectRouteNestedParams, (params) => params && params[param]);
