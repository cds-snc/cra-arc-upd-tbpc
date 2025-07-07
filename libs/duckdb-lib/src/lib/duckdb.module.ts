import { Module } from '@nestjs/common';
import { DuckDbService } from './duckdb.service';
import { BlobStorageModule, BlobStorageService } from '@dua-upd/blob-storage';

@Module({
  imports: [BlobStorageModule],
  providers: [
    BlobStorageService,
    {
      provide: DuckDbService.name,
      inject: [BlobStorageService.name],
      useFactory: async (blob: BlobStorageService) => {
        const duckDb = await DuckDbService.create(':memory:', blob, {
          readOnly: false,
          logger: false,
        });
        await duckDb.setupRemoteExtensions();
        await duckDb.setupRemoteAuth();
        return duckDb;
      },
    },
  ],
  exports: [DuckDbService.name],
})
export class DuckDbModule {}
