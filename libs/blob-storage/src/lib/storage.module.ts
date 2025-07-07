import { Module } from '@nestjs/common';
import { BlobStorageService } from './storage.service';

@Module({
  providers: [
    {
      provide: BlobStorageService.name,
      useFactory: async () =>
        await BlobStorageService.init(
          process.env['STORAGE_URI_PREFIX'] === 's3://' ? 's3' : 'azure',
        ),
    },
  ],
  exports: [BlobStorageService.name],
})
export class BlobStorageModule {}
