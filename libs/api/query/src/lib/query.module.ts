import { DbModule } from '@dua-upd/db';
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { hours } from '@dua-upd/utils-common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';

@Module({
  imports: [CacheModule.register({ ttl: hours(3) }), DbModule],
  controllers: [QueryController],
  providers: [QueryService],
  exports: [QueryService],
})
export class QueryModule {}
