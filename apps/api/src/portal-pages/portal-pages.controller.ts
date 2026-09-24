import { Controller, Get, Header, Query } from '@nestjs/common';
import { PortalPagesService } from './portal-pages.service';

@Controller('portal-pages')
export class PortalPagesController {
  constructor(
    private readonly portalPagesService: PortalPagesService,
  ) {}

  @Get('home')
  @Header('Content-Type', 'application/json')
  getHomeData(@Query('dateRange') dateRange: string) {
    return this.portalPagesService.getHomeData(dateRange);
  }

  @Get('details')
  getDetails(
    @Query('id') id: string,
    @Query('dateRange') dateRange: string,
    @Query('comparisonDateRange') comparisonDateRange: string,
  ) {
    return this.portalPagesService.getDetails(
      id,
      dateRange,
      comparisonDateRange,
    );
  }
}