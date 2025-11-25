import {
  Controller,
  Get,
  Header,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { OverallService } from './overall.service';

@Controller('overall')
export class OverallController {
  constructor(private readonly overallService: OverallService) {}

  @Get()
  @Header('Content-Type', 'application/json')
  getMetrics(
    @Query('dateRange') dateRange: string,
    @Query('comparisonDateRange') comparisonDateRange: string,
    @Query('ipd', ParseBoolPipe) ipd: boolean,
  ) {
    if (ipd) {
      console.log('IPD MODE ACTIVATED 🤖');
    }

    return this.overallService.getMetrics({
      dateRange,
      comparisonDateRange,
      ipd,
    });
  }

  @Get('feedback')
  @Header('Content-Type', 'application/json')
  getFeedback(
    @Query('dateRange') dateRange: string,
    @Query('comparisonDateRange') comparisonDateRange: string,
    @Query('ipd', ParseBoolPipe) ipd: boolean,
  ) {
    return this.overallService.getFeedback({
      dateRange,
      comparisonDateRange,
      ipd,
    });
  }

  @Get('comments-and-words')
  @Header('Content-Type', 'application/json')
  getCommentsAndWords(
    @Query('dateRange') dateRange: string,
    @Query('comparisonDateRange') comparisonDateRange: string,
    @Query('part', ParseIntPipe) part: number,
  ) {
    return this.overallService.getCachedCommentsAndWordsChunk(
      {
        dateRange,
        comparisonDateRange,
      },
      part,
    );
  }

  @Get('most-relevant')
  @Header('Content-Type', 'application/json')
  getMostRelevant(
    @Query('dateRange') dateRange: string,
    @Query('comparisonDateRange') comparisonDateRange: string,
    @Query('ipd', ParseBoolPipe) ipd: boolean,
    @Query('part', ParseIntPipe) part: number,
  ) {
    return this.overallService.getCachedCommentsAndWordsChunk(
      {
        dateRange,
        comparisonDateRange,
        ipd,
      },
      part,
    );
  }
}
