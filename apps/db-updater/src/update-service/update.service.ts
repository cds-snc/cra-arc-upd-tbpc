import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DbUpdateService } from '@dua-upd/db-update';
import { DataIntegrityService } from '@dua-upd/data-integrity';
import { DbService } from '@dua-upd/db';
import { environment } from '../environments/environment';

export const EVERY_SUNDAY_AT_11PM = '0 0 23 * * 0' as const;
export const EVERY_SATURDAY_AT_11PM = '0 0 23 * * 6' as const;

@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name);
  private isRunning = false;

  constructor(
    private dataIntegrityService: DataIntegrityService,
    private dbUpdateService: DbUpdateService,
    private db: DbService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async updateDatabase() {
    if (this.isRunning) {
      return;
    }

    try {
      this.isRunning = true;

      await this.dbUpdateService.updateAll(environment.production);

      await this.dataIntegrityService.fillMissingData();
      await this.dataIntegrityService.cleanPageUrls();

      await this.dbUpdateService.recalculateViews(true);
    } catch (error) {
      this.logger.error(error.stack);
    } finally {
      this.isRunning = false;
    }

    this.logger.log('Database updates completed.');
  }

  @Cron(EVERY_SATURDAY_AT_11PM)
  async addMissingAirtableRefsToPageMetrics() {
    try {
      await this.db.addMissingAirtableRefsToPageMetrics()
    } catch (error) {
      this.logger.error(error.stack);
    }
  }

  @Cron(EVERY_SUNDAY_AT_11PM)
  async runSAT() {
    if (this.isRunning) {
      return;
    }

    try {
      this.isRunning = true;

      await this.dbUpdateService.updateSAT();
    } catch (error) {
      this.logger.error(error);
    } finally {
      this.isRunning = false;
    }
  }
}
