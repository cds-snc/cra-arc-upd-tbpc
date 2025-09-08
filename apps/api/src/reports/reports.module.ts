import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DbModule, DbService } from '@dua-upd/db';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { hours } from '@dua-upd/utils-common';

@Module({
  imports: [CacheModule.register({ ttl: hours(12) }), DbModule],
  controllers: [ReportsController],
  providers: [ReportsService, DbService],
})
export class ReportsModule {}
