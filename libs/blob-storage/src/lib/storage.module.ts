import { Module } from '@nestjs/common';
import { BlobStorageService } from './storage.service';

@Module({
  providers: [
    {
      provide: BlobStorageService.name,
      useFactory: async () =>
        await BlobStorageService.init(),
    },
  ],
  exports: [BlobStorageService.name],
})
export class BlobStorageModule {}
