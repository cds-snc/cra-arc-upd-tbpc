import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { DbModule } from '@dua-upd/db';
import { hours } from '@dua-upd/utils-common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackCache } from './feedback.cache';

@Module({
  imports: [CacheModule.register({ ttl: hours(3) }), DbModule],
  controllers: [FeedbackController],
  providers: [FeedbackCache, FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
