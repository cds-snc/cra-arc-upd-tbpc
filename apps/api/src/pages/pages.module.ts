import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { DbModule, DbService } from '@dua-upd/db';
import { hours } from '@dua-upd/utils-common';
import { FeedbackModule } from '@dua-upd/api/feedback';
import { FlowModule } from '@dua-upd/api/flow';
import { ExternalDataModule } from '@dua-upd/external-data';

@Module({
  imports: [
    CacheModule.register({ ttl: hours(12) }),
    DbModule,
    FeedbackModule,
    FlowModule.register(),
    ExternalDataModule,
  ],
  controllers: [PagesController],
  providers: [PagesService, DbService],
})
export class PagesModule {}
