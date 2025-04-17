import { Module } from '@nestjs/common';
import { AirtableClient } from '../lib/airtable';
import { SearchAssessmentService } from './search-assessment.service';
import { ConsoleLogger } from '@nestjs/common';
import { DbModule, DbService } from '@dua-upd/db';

@Module({
  imports: [
    DbModule,
  ],
  providers: [
    {
      provide: AirtableClient.name,
      useFactory: () => new AirtableClient(),
    },
    SearchAssessmentService,
    ConsoleLogger,
    DbService,
  ],
  exports: [AirtableClient.name, SearchAssessmentService, ConsoleLogger],
})
export class SearchAssessmentModule {}
