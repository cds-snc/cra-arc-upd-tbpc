import { Module } from '@nestjs/common';
import { DbModule, PortalPages, PortalPagesMetrics } from '@dua-upd/db';
import { CacheModule } from '@nestjs/cache-manager';
import { hours } from '@dua-upd/utils-common';
import { PortalPagesController } from './portal-pages.controller';
import { PortalPagesService } from './portal-pages.service';

@Module({
  imports: [DbModule, CacheModule.register({ ttl: hours(4) })],
  controllers: [PortalPagesController],
  providers: [PortalPagesService],
})
export class PortalPagesModule {}
