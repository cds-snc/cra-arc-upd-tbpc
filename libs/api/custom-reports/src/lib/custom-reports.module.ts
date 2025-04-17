import { randomUUID } from 'crypto';
import { getAACredsPool } from '@dua-upd/node-utils';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AdobeAnalyticsClient } from './clients/adobe-analytics.client';
import { CustomReportsCache } from './custom-reports.cache';
import { CustomReportsController } from './custom-reports.controller';
import { DbModule, DbService } from '@dua-upd/db';
import { hours } from '@dua-upd/utils-common';
import {
  ChildQueueEvents,
  ReportsQueueEvents,
} from './custom-reports.listeners';
import { CustomReportsService } from './custom-reports.service';
import {
  FetchAndProcessDataProcessor,
  PrepareReportDataProcessor,
} from './custom-reports.processors';

export const instanceId = process.env['INSTANCE_ID'] || randomUUID();

@Module({})
export class CustomReportsModule {
  static register(production = false) {
    return {
      module: CustomReportsModule,
      imports: [
        CacheModule.register({ ttl: hours(3) }),
        DbModule,
        BullModule.registerQueue({
          name: 'prepareReportData',
          prefix: instanceId,
        }),
        BullModule.registerQueue({
          name: 'fetchAndProcessReportData',
          prefix: instanceId,
        }),
        BullModule.registerFlowProducer({
          name: 'reportFlow',
          prefix: instanceId,
        }),
      ],
      controllers: [CustomReportsController],
      providers: [
        CustomReportsService,
        CustomReportsCache,
        DbService,
        PrepareReportDataProcessor,
        FetchAndProcessDataProcessor,
        ReportsQueueEvents,
        ChildQueueEvents,
        {
          provide: 'INSTANCE_ID',
          useValue: instanceId,
        },
      ],
    };
  }
}
