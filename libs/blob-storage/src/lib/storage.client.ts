/**
 * Unified storage client that can switch between Azure Blob Storage and AWS S3
 * based on environment configuration.
 *
 * This provides interface compatibility while allowing the underlying implementation
 * to be switched via environment variables.
 */

import {
  type BlobClient as AzureBlobClient,
  type AzureBlobType,
  AzureStorageClient,
  AzureStorageContainer,
  BlobsConfig,
  BlobModel as AzureBlobModel,
} from './azure.storage.client';
import { S3StorageClient, S3Bucket, S3ObjectConfig } from './s3.storage.client';
import type { S3ObjectClient, S3ObjectModel } from './s3.storage.client';
import type { CompressionAlgorithm } from '@dua-upd/node-utils';
import { RegisteredBlobModel } from './storage.service';

export type StorageProvider = 'azure' | 's3';

export type BlobClient = AzureBlobClient | S3ObjectClient;

// Unified configuration type that works for both Azure and S3
export type StorageConfig = {
  path?: string;
  container: StorageContainer;
  overwrite?: boolean;
  compression?: CompressionAlgorithm;
};

export type StorageClientOptions = {
  azureConnectionString?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
};

/**
 * Unified storage client that abstracts away the differences between Azure and S3
 */
export class StorageClient {
  private client: AzureStorageClient | S3StorageClient | null = null;
  readonly storageType: StorageProvider;

  constructor(provider: StorageProvider, options?: StorageClientOptions) {
    this.storageType = provider;

    if (this.storageType === 'azure') {
      try {
        this.client = new AzureStorageClient(options?.azureConnectionString);
      } catch (error) {
        console.error('Failed to initialize Azure storage client:', error);
        throw error;
      }
    } else {
      try {
        this.client = new S3StorageClient(
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
  }

  async container(containerName: string): Promise<StorageContainer | null> {
    return await this.client?.container(containerName);
  }

  async listContainers(): Promise<string[]> {
    return await this.client.listContainers();
  }
}

/**
 * Unified container/bucket wrapper that abstracts Azure containers and S3 buckets
 */
export class StorageContainer {
  constructor(
    private readonly container: AzureStorageContainer | S3Bucket | null,
    private readonly storageType: StorageProvider,
  ) {}

  createBlobsClient(config: Omit<StorageConfig, 'container'>): BlobModel {
    return new BlobModel({ ...config, container: this });
  }

  getClient() {
    return this.container.getClient();
  }

  getStorageType() {
    return this.storageType;
  }

  /** Expose the underlying container for BlobModel to use */
  get _inner() {
    return this.container;
  }

  async listBlobs(prefix?: RegisteredBlobModel) {
    return await this.container.listBlobs(prefix);
  }

  async mapBlobs<T>(
    mapFunc: (item: any) => T,
    prefix?: RegisteredBlobModel,
  ): Promise<T[]> {
    return await this.container.mapBlobs(mapFunc, prefix);
  }
}

/**
 * Unified blob/object model that works with both Azure and S3
 */
export class BlobModel {
  private readonly container: StorageContainer;
  private readonly model: AzureBlobModel | S3ObjectModel;

  constructor(private readonly config: StorageConfig) {
    this.container = this.config.container;

    // Use the underlying Azure or S3 container directly
    const rawContainer = this.container._inner;

    this.model = rawContainer.createBlobsClient({
      path: this.config.path,
      overwrite: this.config.overwrite,
      compression: this.config.compression,
    });
  }

  getContainer() {
    return this.container;
  }

  blob(blobName: string, blobType?: AzureBlobType) {
    return this.model.blob(blobName, blobType);
  }
}
