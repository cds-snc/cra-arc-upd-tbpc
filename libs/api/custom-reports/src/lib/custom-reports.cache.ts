import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { compressString, decompressString } from '@dua-upd/node-utils';
import type { ReportDataPoint } from './custom-reports.service';

type Report = Record<string, unknown>[];

@Injectable()
export class CustomReportsCache {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async getReport(reportId: string): Promise<Report | undefined> {
    return this.cache
      .get<string>(`report:${reportId}`)
      .then(
        async (report) => report && JSON.parse(await decompressString(report)),
      );
  }

  async setReport(reportId: string, report: Report) {
    return this.cache.set(
      `report:${reportId}`,
      await compressString(JSON.stringify(report)),
    );
  }

  async getDataPoints(dataPointHashes: string[]) {
    return (await this.cache.mget(dataPointHashes)) as Record<
      string,
      ReportDataPoint
    >[];
  }

  async setDataPoints(dataPoints: Record<string, ReportDataPoint>) {
    return await this.cache.mset(Object.entries(dataPoints).map(([key, value]) => ({
      key,
      value,
      ttl: 60 * 60 * 3, // 3 hours
    })));
  }
}
