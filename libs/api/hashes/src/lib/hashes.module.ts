import { Module } from '@nestjs/common';
import { HashesController } from './hashes.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { HashesService } from './hashes.service';
import { hours } from '@dua-upd/utils-common';
import { HashesCache } from './hashes.cache';
import { DbModule } from '@dua-upd/db';
import { BlobStorageModule, BlobStorageService } from '@dua-upd/blob-storage';
import { DuckDbModule } from '@dua-upd/duckdb';

@Module({
  imports: [
    CacheModule.register({ ttl: hours(3) }),
    DbModule,
    BlobStorageModule,
    DuckDbModule,
  ],
  controllers: [HashesController],
  providers: [HashesCache, HashesService, BlobStorageService],
  exports: [HashesService],
})
export class HashesModule {}
