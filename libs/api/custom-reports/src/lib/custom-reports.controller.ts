import type {
  ReportConfig,
  ReportCreateResponse,
  ReportStatus,
} from '@dua-upd/types-common';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CustomReportsService } from './custom-reports.service';

@Controller('custom-reports')
export class CustomReportsController {
  constructor(private reportsService: CustomReportsService) {}

  @Post('create')
  async create(@Body() request: ReportConfig): Promise<ReportCreateResponse> {
    return { _id: await this.reportsService.create(request) };
  }

  @Get(':id')
  async getReport(@Param('id') id: string): Promise<ReportStatus> {
    try {
      const report = await this.reportsService.fetchOrPrepareReport(id);

      if (report) {
        return {
          status: 'complete',
          data: report,
        } as ReportStatus;
      }

      return { status: 'pending', message: 'fetching data...' };
    } catch (err) {
      return {
        status: 'error',
        message: (<Error>err).message,
      };
    }
  }

  @Get(':id/status')
  async getStatus(@Param('id') id: string): Promise<ReportStatus> {
    const reportStatus = await this.reportsService.getStatus(id);

    if (!reportStatus) {
      return {
        status: 'error',
        message: 'report not found',
      }
    }

    return 'error' in reportStatus
    ? {
        ...reportStatus,
        message: 'Could not fetch report data',
      }
    : reportStatus;
  }
}
