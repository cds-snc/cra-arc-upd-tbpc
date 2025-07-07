import { Test, TestingModule } from '@nestjs/testing';
import { BlobStorageService } from './storage.service';

describe('StorageService', () => {
  let service: BlobStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BlobStorageService.name,
          useFactory: async () => await BlobStorageService.init('azure'),
        },
      ],
    }).compile();

    service = module.get<BlobStorageService>(BlobStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
