import { Injectable, Logger } from '@nestjs/common';
import { DbUpdateService } from '@dua-upd/db-update';
import { DataIntegrityService } from '@dua-upd/data-integrity';
import { DbService } from '@dua-upd/db';

@Injectable()
export class UpdateTaskService {
  private readonly logger = new Logger(UpdateTaskService.name);

  constructor(
    private dataIntegrityService: DataIntegrityService,
    private dbUpdateService: DbUpdateService,
    private db: DbService,
  ) {}

  async updateDatabase() {
    await this.db.ensureIndexes();

    // if db is empty, skip updating

    if (!(await this.db.collections.pageMetrics.findOne())) {
      this.logger.warn('No page metrics found, skipping updates.');
      return;
    }

    try {
      this.logger.log('Starting database updates...');

      if (!(await this.db.collections.pageMetrics.findOne())) {
        this.logger.warn('No page metrics found, skipping updates.');
        return;
      }

      const dayOfWeek = new Date().getDay();

      if (dayOfWeek === 6) {
        // Saturday
        await this.db.addMissingAirtableRefsToPageMetrics();
      }

      if (dayOfWeek === 0 && process.env['ENV'] === 'production') {
        // Sunday
        await this.dbUpdateService.updateSAT();
      }

      await this.dbUpdateService.updateAll(false);

      await this.dataIntegrityService.fillMissingData();
      await this.dataIntegrityService.cleanPageUrls();

      await this.dbUpdateService.recalculateViews(false);
    } catch (error) {
      this.logger.error(error.stack);
      throw error; // Re-throw to ensure the error is handled by the caller
    }

    this.logger.log('Database updates completed.');
  }
}
