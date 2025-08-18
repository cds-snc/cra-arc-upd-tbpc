import { BlobLogger } from '@dua-upd/logger';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  type IStorageModel,
  BlobStorageService,
  type RegisteredBlobModel,
} from '@dua-upd/blob-storage';

@Injectable()
export class BlobProxyService {
  constructor(
    @Inject(BlobStorageService.name)
    private readonly blobStorageService: BlobStorageService,
    @Optional() @Inject('ENV') private production = false,
    @Optional() @Inject('DB_UPDATE_LOGGER') private blobLogger: BlobLogger,
  ) {
    if (this.blobLogger && !this.production) {
      this.blobLogger.disableBlobLogging();
    }
  }

  createProxy<QueryParams, Metadata, ReturnType>(
    config: BlobProxyConfig<QueryParams, Metadata, ReturnType>,
  ) {
    return new BlobProxy<QueryParams, Metadata, ReturnType>(
      this.blobStorageService,
      config,
    );
  }
}

export type BlobProxyConfig<QueryParams, Metadata, ReturnType> = {
  blobModel: RegisteredBlobModel;
  filenameGenerator: (metadata: Metadata) => string;
  queryExecutor: (queryParams: QueryParams) => Promise<ReturnType[]>;
};

export class BlobProxy<QueryParams, Metadata, ReturnType> {
  blobService: BlobStorageService;
  blobModel: IStorageModel<any>;
  config: BlobProxyConfig<QueryParams, Metadata, ReturnType>;

  constructor(
    blobService: BlobStorageService,
    config: BlobProxyConfig<QueryParams, Metadata, ReturnType>,
  ) {
    this.blobService = blobService;
    this.config = config;
    this.blobModel = blobService.blobModels[config.blobModel];
  }

  async exec(
    queryParams: QueryParams,
    metadata: Metadata,
  ): Promise<ReturnType[]> {
    const { filenameGenerator, queryExecutor } = this.config;

    const filename = filenameGenerator(metadata);

    const blob = this.blobModel.blob(filename);

    if (await blob.exists()) {
      const data = await blob.downloadToString();

      return JSON.parse(data);
    }

    const data = await queryExecutor(queryParams);

    await blob.uploadFromString(JSON.stringify(data));

    return data;
  }
}
