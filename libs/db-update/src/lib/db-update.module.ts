import { ConsoleLogger, DynamicModule, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import dayjs from 'dayjs';
import { BlobStorageModule } from '@dua-upd/blob-storage';
import { LoggerModule } from '@dua-upd/logger';
import { DbModule, DbService } from '@dua-upd/db';
import {
  AirtableClient,
  ExternalDataModule,
  SearchAssessmentService,
} from '@dua-upd/external-data';
import { DbUpdateService } from './db-update.service';
import { OverallMetricsService } from './overall-metrics/overall-metrics.service';
import { AirtableService } from './airtable/airtable.service';
import { CalldriversService } from './airtable/calldrivers.service';
import { FeedbackService } from './feedback/feedback.service';
import { PageUpdateService } from './pages/pages.service';
import { PageMetricsService } from './pages-metrics/page-metrics.service';
import { PagesListService } from './pages-list/pages-list.service';
import { InternalSearchTermsService } from './internal-search/search-terms.service';
import { ActivityMapService } from './activity-map/activity-map.service';
import { UrlsService } from './urls/urls.service';
import { ReadabilityService } from './readability/readability.service';
import { AnnotationsService } from './airtable/annotations.service';
import { GcTaskService } from './gc-task/gc-task.service';
import { GCTasksMappingsService } from './airtable/gc-tasks-mappings.service';
import { DuckDbModule } from '@dua-upd/duckdb';

const date = dayjs().format('YYYY-MM-DD');
const month = dayjs().format('YYYY-MM');

@Module({})
export class DbUpdateModule {
  static register(production = false): DynamicModule {
    return {
      module: DbUpdateModule,
      imports: [
        CacheModule.register({ ttl: 12 * 60 * 60 }),
        DbModule,
        ExternalDataModule,
        BlobStorageModule,
        LoggerModule.withBlobLogger('DB_UPDATE_LOGGER', {
          blobModel: 'db_updates',
          context: 'db-update',
          logLevelTargets: {
            error: `${month}/db-update_errors_${date}`,
            warn: `${month}/db-update_${date}`,
            log: `${month}/db-update_${date}`,
          },
        }),
        DuckDbModule,
      ],
      providers: [
        AirtableService,
        CalldriversService,
        ConsoleLogger,
        DbService,
        DbUpdateService,
        InternalSearchTermsService,
        ActivityMapService,
        FeedbackService,
        OverallMetricsService,
        PageUpdateService,
        PageMetricsService,
        PagesListService,
        SearchAssessmentService,
        UrlsService,
        AnnotationsService,
        GcTaskService,
        GCTasksMappingsService,
        {
          provide: AirtableClient.name,
          useFactory: () => new AirtableClient(),
        },
        {
          provide: 'ENV',
          useValue: production,
        },
        ReadabilityService,
      ],
      exports: [
        AirtableClient.name,
        AirtableService,
        CalldriversService,
        DbModule,
        DbService,
        DbUpdateService,
        ExternalDataModule,
        FeedbackService,
        InternalSearchTermsService,
        ActivityMapService,
        OverallMetricsService,
        PageMetricsService,
        PageUpdateService,
        PagesListService,
        ReadabilityService,
        SearchAssessmentService,
        UrlsService,
        AnnotationsService,
        GcTaskService,
        GCTasksMappingsService,
      ],
    };
  }
}
