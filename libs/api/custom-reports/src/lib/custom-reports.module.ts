import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
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
        }),
        BullModule.registerQueue({
          name: 'fetchAndProcessReportData',
        }),
        BullModule.registerFlowProducer({
          name: 'reportFlow',
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
      ],
    };
  }
}
