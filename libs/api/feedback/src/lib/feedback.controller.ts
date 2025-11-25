import { Controller, Get, Query } from '@nestjs/common';
import { FeedbackParams, FeedbackService } from './feedback.service';
import { logJson, parseDateRangeString } from '@dua-upd/utils-common';

@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Get('most-relevant')
  async mostRelevant(
    @Query('dateRange') dateRangeString: string,
    @Query('type') type?: 'page' | 'task' | 'project',
    @Query('id') id?: string,
    @Query('normalizationStrength', { transform: Number })
    b?: number,
    @Query('k1', { transform: Number })
    k1?: number,
    @Query('ipd', { transform: Boolean })
    ipd?: boolean
  ) {
    const params: FeedbackParams = {
      dateRange: parseDateRangeString(dateRangeString),
      type,
      id,
      b,
      k1,
      ipd,
    };

    logJson(params);

    return await this.feedbackService.getMostRelevantCommentsAndWords(params);
  }

  @Get('comments-and-words')
  async commentsAndWords(
    @Query('dateRange') dateRangeString: string,
    @Query('type') type?: 'page' | 'task' | 'project',
    @Query('id') id?: string,
  ) {
    const params: FeedbackParams = {
      dateRange: parseDateRangeString(dateRangeString),
      type,
      id,
    };

    logJson(params);

    return await this.feedbackService.getCommentsAndWords(params);
  }
}
