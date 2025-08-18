import type { ContainerClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { normalize } from 'node:path/posix';
import { CompressionAlgorithm } from '@dua-upd/node-utils';
import { S3StorageClient, type S3Bucket } from './s3.storage.client';
import { AzureStorageClient } from './azure.storage.client';
import type {
  IStorageClient,
  IStorageModel,
  StorageProvider,
} from './storage.interfaces';

export type BlobDefinition = {
  containerName: string;
  path?: string;
  overwrite?: boolean;
  compression?: CompressionAlgorithm;
};

export type StorageClientOptions = {
  azureConnectionString?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
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
  private _storageClient: IStorageClient<S3Bucket | ContainerClient> | null =
    null;

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

  readonly blobModels: Record<
    RegisteredBlobModel,
    IStorageModel<S3Bucket | ContainerClient> | null
  > = {
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

  setStorageProvider(
    storageProvider: StorageProvider,
    options?: StorageClientOptions,
  ) {
    if (storageProvider === 'azure') {
      try {
        this._storageClient = new AzureStorageClient(
          options?.azureConnectionString,
        );
      } catch (error) {
        console.error('Failed to initialize Azure storage client:', error);
        throw error;
      }
    } else {
      try {
        this._storageClient = new S3StorageClient(
          options?.s3AccessKeyId || options?.s3SecretAccessKey
            ? {
                accessKeyId: options?.s3AccessKeyId,
                secretAccessKey: options?.s3SecretAccessKey,
              }
            : undefined,
        );
      } catch (error) {
        console.error('Failed to initialize S3 storage client:', error);
        throw error;
      }
    }

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
