import { Module } from '@nestjs/common';
import { BlobStorageService } from './storage.service';

@Module({
  providers: [
    {
      provide: BlobStorageService.name,
      useFactory: async () =>
        await BlobStorageService.init(
          process.env['STORAGE_URI_PREFIX'] === 'az://' ? 'azure' : 's3',
        ),
    },
  ],
  exports: [BlobStorageService.name],
})
export class BlobStorageModule {}
