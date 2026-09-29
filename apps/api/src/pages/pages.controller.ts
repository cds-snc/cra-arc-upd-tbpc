import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import type { PageHighlightsData } from '@dua-upd/types-common';
import { PagesService } from './pages.service';

type PageHighlightsRequest = {
  pageData: PageHighlightsData;
};

@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post('page-highlights')
  async getPageHighlights(@Body() request: PageHighlightsRequest) {
    return {
      highlights: await this.pagesService.getPageHighlights(request.pageData),
    };
  }

  @Get('home')
  @Header('Content-Type', 'application/json')
  getPagesHomeData(@Query('dateRange') dateRange: string) {
    return this.pagesService.getPagesHomeData(dateRange);
  }

  @Get('details')
  getPageDetails(
    @Query('id') id: string,
    @Query('dateRange') dateRange: string,
    @Query('comparisonDateRange') comparisonDateRange: string,
  ) {
    return this.pagesService.getPageDetails({
      id,
      dateRange,
      comparisonDateRange,
    });
  }

  @Get('flow')
  async getFlowData(
    @Query('direction') direction: 'next' | 'previous' | 'focal',
    @Query('limit') limit: number,
    @Query('urls') urls: string,
    @Query('dateRange') dateRange: string,
  ) {
    try {
      return await this.pagesService.getFlowData(
        direction,
        limit,
        urls,
        dateRange,
      );
    } catch (error) {
      return error;
    }
  }

  @Get('accessibility-test')
  @Header('Content-Type', 'application/json')
  async runAccessibilityTest(@Query('url') url: string) {
    return this.pagesService.runAccessibilityTest(url);
  }

  @Get('getPageId')
  getPageId(@Query('url') url: string) {
    return this.pagesService.getPageId(url);
  }
}
