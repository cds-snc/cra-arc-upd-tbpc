import { Module } from '@nestjs/common';
import { DbModule, PortalPages, PortalPagesMetrics } from '@dua-upd/db';
import { PortalPagesController } from './portal-pages.controller';
import { PortalPagesService } from './portal-pages.service';

@Module({
  imports: [DbModule],
  controllers: [PortalPagesController],
  providers: [PortalPagesService],
})
export class PortalPagesModule {}