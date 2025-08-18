export * from './lib/storage.service';
export * from './lib/storage.module';
export * from './lib/storage.utils';
export * from './lib/storage.interfaces';

// Export specific classes with aliases to avoid conflicts
export {
  AzureStorageClient,
  AzureStorageContainer,
  BlobModel as AzureBlobModel,
  BlobClient as AzureBlobClient,
  type AzureBlobType,
} from './lib/azure.storage.client';

export {
  S3StorageClient,
  S3Bucket,
  S3ObjectModel,
  S3ObjectClient,
} from './lib/s3.storage.client';
