import { Module } from '@nestjs/common';
import { ConsoleLogger } from '@nestjs/common';
import { BlobStorageModule, BlobStorageService } from '@dua-upd/blob-storage';
import { DbModule, DbService } from '@dua-upd/db';
import { ReadabilityService } from './readability.service';

@Module({
  imports: [
    DbModule,
    BlobStorageModule,
  ],
  providers: [ReadabilityService, ConsoleLogger, DbService, BlobStorageService],
  exports: [ReadabilityService, ConsoleLogger],
})
export class ReadabilityModule {}
