import { Injectable } from '@nestjs/common';
import {
  BlobModel,
  StorageClient,
  type StorageProvider,
} from './storage.client';
import { normalize } from 'node:path/posix';
import { CompressionAlgorithm } from '@dua-upd/node-utils';

export type BlobDefinition = {
  containerName: string;
  path?: string;
  overwrite?: boolean;
  compression?: CompressionAlgorithm;
};

/*
 * Use this variable as the primary Blob Model "registry".
 * Once you add the model name here, you can let the type errors guide you.
 */
export const blobModels = [
  'project_attachments',
  'reports',
  'db_updates',
  'aa_raw',
  'feedback',
  'urls',
  'html_snapshots',
  'html_snapshots_backup',
] as const;

export type BlobModels = typeof blobModels;
export type RegisteredBlobModel = BlobModels[number];

@Injectable()
export class BlobStorageService {
  private _storageClient: StorageClient | null = null;

  private readonly blobDefinitions: Record<
    RegisteredBlobModel,
    BlobDefinition
  > = {
    project_attachments: {
      path: 'project_attachments',
      containerName: 'documents',
      overwrite: true,
    },
    reports: {
      path: 'reports',
      containerName: 'documents',
    },
    db_updates: {
      path: 'db_updates',
      containerName: 'logs',
    },
    aa_raw: {
      path: 'aa_raw',
      containerName: 'raw-data',
      compression: 'zstd',
    },
    feedback: {
      path: 'feedback',
      containerName: 'raw-data',
      compression: 'zstd',
    },
    urls: {
      path: 'urls',
      containerName: 'raw-data',
      compression: 'zstd',
    },
    html_snapshots: {
      containerName: 'html-snapshots',
    },
    html_snapshots_backup: {
      path: 'backup',
      containerName: 'html-snapshots',
    },
  } as const;

  readonly blobModels: Record<RegisteredBlobModel, BlobModel | null> = {
    db_updates: null,
    project_attachments: null,
    reports: null,
    aa_raw: null,
    feedback: null,
    urls: null,
    html_snapshots: null,
    html_snapshots_backup: null,
  };

  get storageClient() {
    return this._storageClient;
  }

  setStorageProvider(storageProvider: StorageProvider) {
    this._storageClient = new StorageClient(storageProvider);
    return this;
  }

  private async configureBlobs(): Promise<BlobStorageService> {
    for (const [modelName, blobDefinition] of Object.entries(
      this.blobDefinitions,
    ) as [RegisteredBlobModel, BlobDefinition][]) {
      const trueContainer =
        this.storageClient.storageType === 's3'
          ? process.env['DATA_BUCKET_NAME']
          : blobDefinition.containerName;

      if (
        this.storageClient.storageType === 's3' &&
        !process.env['DATA_BUCKET_NAME']
      ) {
        throw new Error(
          `storageType is 's3' but DATA_BUCKET_NAME is not defined`,
        );
      }

      const truePath =
        this.storageClient.storageType === 's3'
          ? normalize(
              `${blobDefinition.containerName}/${blobDefinition.path ?? ''}`,
            )
          : normalize(`${blobDefinition.path ?? ''}`);

      const container = await this._storageClient?.container(trueContainer);

      this.blobModels[modelName] = container?.createBlobsClient({
        path: truePath,
        overwrite: blobDefinition['overwrite'],
        compression: blobDefinition['compression'],
      });
    }

    return this;
  }

  static async init(storageProvider: StorageProvider) {
    return await new BlobStorageService()
      .setStorageProvider(storageProvider)
      .configureBlobs();
  }

  async container(containerName: string) {
    return this._storageClient.container(containerName);
  }
}
