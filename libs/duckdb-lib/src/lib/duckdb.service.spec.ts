import { Test } from '@nestjs/testing';
import { DuckDbService } from './duckdb.service';
import { sql } from 'drizzle-orm';
import { BlobStorageModule, BlobStorageService } from '@dua-upd/blob-storage';

describe('DuckDbService', () => {
  let service: DuckDbService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [BlobStorageModule],
      providers: [
        {
          inject: [BlobStorageService.name],
          provide: DuckDbService.name,
          useFactory: async (blob: BlobStorageService) => {
            return DuckDbService.create(':memory:', blob, {
              readOnly: false,
              logger: true,
            });
          },
        },
      ],
    }).compile();

    service = module.get(DuckDbService.name);
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });

  it('should be able to run a query', async () => {
    const result = await service.db.execute(sql`SELECT 1 AS one`);
    expect(result).toEqual([{ one: 1 }]);
  });
});
