import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { OverallService } from './overall.service';
import { OverallController } from './overall.controller';
import { DbModule } from '@dua-upd/db';
import { hours } from '@dua-upd/utils-common';
import { FeedbackModule } from '@dua-upd/api/feedback';

@Module({
  imports: [CacheModule.register({ ttl: hours(12) }), DbModule, FeedbackModule],
  controllers: [OverallController],
  providers: [OverallService],
})
export class OverallModule {}
