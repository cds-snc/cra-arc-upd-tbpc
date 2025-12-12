import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { DbModule } from '@dua-upd/db';
import { hours } from '@dua-upd/utils-common';
import { FeedbackModule } from '@dua-upd/api/feedback';

@Module({
  imports: [CacheModule.register({ ttl: hours(12) }), DbModule, FeedbackModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
