import { Module, DynamicModule } from '@nestjs/common';
import { FlowController } from './flow.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { FlowService } from './flow.service';
import { hours } from '@dua-upd/utils-common';
import { FlowCache } from './flow.cache';
import { DbModule, DbService } from '@dua-upd/db';

@Module({})
export class FlowModule {
  static register(production = false): DynamicModule {
    return {
      module: FlowModule,
      imports: [CacheModule.register({ ttl: hours(3) }), DbModule],
      controllers: [FlowController],
      providers: [FlowService, FlowCache, DbService],
      exports: [FlowService],
    };
  }
}
