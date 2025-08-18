/**
 * Common interfaces for storage clients to ensure consistent APIs
 * between Azure Blob Storage and AWS S3 implementations.
 */

import type { Readable } from 'stream';
import type { CompressionAlgorithm } from '@dua-upd/node-utils';
import type { RegisteredBlobModel } from './storage.service';

export type StorageProvider = 'azure' | 's3';

/**
 * Configuration for blob/object storage operations
 */
export interface IStorageConfig {
  path?: string;
  overwrite?: boolean;
  compression?: CompressionAlgorithm;
}

/**
 * Properties returned when getting object/blob metadata
 */
export interface IStorageProperties {
  lastModified?: Date;
  contentLength?: number;
  etag?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Options for upload operations
 */
export interface IUploadOptions {
  compression?: CompressionAlgorithm;
  logProgress?: boolean;
  overwrite?: boolean;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

/**
 * Options for download operations
 */
export interface IDownloadOptions {
  decompressData?: boolean;
  blockSize?: number;
  concurrency?: number;
}

/**
 * Base storage client interface - implemented by both Azure and S3 clients
 */
export interface IStorageClient<ContainerClientT> {
  storageType: StorageProvider;

  /**
   * Get a container/bucket by name
   */
  container(containerName: string): Promise<IStorageContainer<ContainerClientT> | null>;

  /**
   * List all containers/buckets
   */
  listContainers(): Promise<string[]>;
}

/**
 * Container/Bucket interface - abstracts Azure containers and S3 buckets
 */
export interface IStorageContainer<ContainerClientT> {
  /**
   * Create a blob/object model client for this container
   */
  createBlobsClient(config: IStorageConfig): IStorageModel<ContainerClientT>;

  /**
   * List blobs/objects in the container
   */
  listBlobs(prefix?: RegisteredBlobModel): Promise<void>;

  /**
   * Map over blobs/objects in the container
   */
  mapBlobs<T>(
    mapFunc: (item: any) => T,
    prefix?: RegisteredBlobModel,
  ): Promise<T[]>;
}

/**
 * Blob/Object model interface - abstracts blob models and object models
 */
export interface IStorageModel<ContainerClientT> {
  /**
   * Get the container this model belongs to
   */
  getContainer(): IStorageContainer<ContainerClientT>;

  /**
   * Create a blob/object client
   */
  blob(name: string, type?: any): IStorageBlob;
}

/**
 * Individual blob/object interface - abstracts Azure BlobClient and S3 ObjectClient
 */
export interface IStorageBlob {
  /** The URL of the blob/object */
  readonly url: string;

  /** The filename of the blob/object */
  readonly filename: string;

  /**
   * Check if the blob/object exists
   */
  exists(): Promise<boolean>;

  /**
   * Get blob/object properties
   */
  getProperties(): Promise<IStorageProperties>;

  /**
   * Get the size of the blob/object in bytes
   */
  getSize(): Promise<number>;

  /**
   * Set cache control headers
   */
  setCacheControl(cacheControl: string): Promise<any>;

  /**
   * Set compression algorithm
   */
  setCompression(algorithm: CompressionAlgorithm | void): IStorageBlob;

  /**
   * Set metadata
   */
  setMetadata(metadata: Record<string, string>): Promise<void>;

  /**
   * Check if local file size differs from stored blob/object
   */
  sizesAreDifferent(fileSizeBytes: number): Promise<boolean>;

  /**
   * Copy from a URL
   */
  copyFromUrl(sourceUrl: string): Promise<void>;

  /**
   * Copy from URL only if file sizes are different
   */
  copyFromUrlIfDifferent(
    sourceUrl: string,
    fileSizeBytes: number,
  ): Promise<void>;

  /**
   * Download to a file
   */
  downloadToFile(
    destinationFilePath: string,
    options?: IDownloadOptions,
  ): Promise<any>;

  /**
   * Upload from a file
   */
  uploadFromFile(filepathToUpload: string): Promise<any>;

  /**
   * Upload from a string
   */
  uploadFromString(string: string, options?: IUploadOptions): Promise<any>;

  /**
   * Upload from a stream
   */
  uploadStream<T extends Readable>(
    stream: T,
    overwrite?: boolean,
  ): Promise<any>;

  /**
   * Download to a string
   */
  downloadToString(options?: IDownloadOptions): Promise<string | undefined>;

  /**
   * Append text (for append-type blobs/objects)
   */
  append(text: string): Promise<void>;

  /**
   * Delete the blob/object
   */
  delete(): Promise<void>;
}
