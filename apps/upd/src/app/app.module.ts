import { NgModule, isDevMode } from '@angular/core';
import { APP_BASE_HREF, NgOptimizedImage } from '@angular/common';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { BrowserModule, Title } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ServiceWorkerModule } from '@angular/service-worker';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { routerReducer, StoreRouterConnectingModule } from '@ngrx/router-store';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { I18nModule, I18nService } from '@dua-upd/upd/i18n';
import {
  DateSelectionEffects,
  DateSelectionFacade,
  dateSelectionReducer,
  i18nReducer,
  I18nEffects,
  I18nFacade,
} from '@dua-upd/upd/state';
import { environment } from '../environments/environment';
import { SwUpdateService } from './sw-update.service';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

@NgModule({
  declarations: [AppComponent, HeaderComponent, SidebarComponent],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    I18nModule.forRoot(),
    BrowserAnimationsModule,
    AppRoutingModule,
    StoreModule.forRoot(
      {
        dateSelection: dateSelectionReducer,
        router: routerReducer,
        i18n: i18nReducer,
      },
      {
        metaReducers: environment.metaReducers,
        runtimeChecks: {
          strictActionImmutability: true,
          strictStateImmutability: true,
        },
      },
    ),
    StoreRouterConnectingModule.forRoot(),
    EffectsModule.forRoot([DateSelectionEffects, I18nEffects]),
    NgOptimizedImage,
    environment.envImports,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
  providers: [
    provideAnimationsAsync(),
    Title,
    DateSelectionFacade,
    I18nService,
    I18nFacade,
    { provide: APP_BASE_HREF, useValue: '/' },
    SwUpdateService,
    provideHttpClient(withInterceptorsFromDi()),
    providePrimeNG({
      theme: {
          preset: definePreset(Aura, {
            semantic: {
                primary: {
                    50: '{blue.50}',
                    100: '{blue.100}',
                    200: '{blue.200}',
                    300: '{blue.300}',
                    400: '{blue.400}',
                    500: '{blue.500}',
                    600: '{blue.600}',
                    700: '{blue.700}',
                    800: '{blue.800}',
                    900: '{blue.900}',
                    950: '{blue.950}'
                }
            }
        }),
          // preset: Lara, // based on bootstrap
          options: {
              prefix: 'p',
              darkModeSelector: 'class',
              cssLayer: {
                name: 'primeng',
              }
          }
      }
  })
  ],
})
export class AppModule {}
