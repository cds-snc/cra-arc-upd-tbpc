/**
 * Building blocks for an ORM-like wrapper for Azure Blob Storage
 *
 * Main purposes for the abstraction are:
 * - Abstract away lower-level details of configuring and interacting with Blob Storage
 * - Enforce a "registry" for Blob Containers and "Blob Models" to prevent overlap of container names and/or paths
 * - Expose the base functionality for upload/download/etc. as well as configuration and create
 *      an environment to extend and build on that functionality for specific use-cases
 */

import type { Readable } from 'stream';
import { cpus } from 'os';
import {
  AppendBlobClient,
  BlobBeginCopyFromURLResponse,
  BlobClient as AzureBlobClient,
  BlobDownloadToBufferOptions,
  BlobItem,
  BlobServiceClient,
  BlockBlobClient,
  BlockBlobParallelUploadOptions,
  ContainerClient,
} from '@azure/storage-blob';
import chalk from 'chalk';
import { stat, writeFile } from 'fs/promises';
import { normalize } from 'path/posix';
import { makeFileUploadProgressLogger } from './storage.utils';
import { logJson } from '@dua-upd/utils-common';
import { Buffer } from 'buffer';
import {
  CompressionAlgorithm,
  compressString,
  decompressString,
} from '@dua-upd/node-utils';
import { RegisteredBlobModel } from './storage.service';

export type AzureBlobType = 'block' | 'append';

/**
 * The base client for connecting to Blob storage. Wraps the official Azure client.
 * Used to initialize a client with the proper credentials and for creating
 * or managing container clients.
 */
export class AzureStorageClient {
  private readonly baseClient: BlobServiceClient;

  constructor(connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING) {
    if (!connectionString) {
      throw new Error(
        'Azure Storage configuration not found. Please set AZURE_STORAGE_CONNECTION_STRING in your environment.',
      );
    }

    try {
      this.baseClient =
        BlobServiceClient.fromConnectionString(connectionString);
    } catch (err) {
      throw new Error('Failed to initialize Azure Storage client.', {
        cause: err,
      });
    }
  }

  getConnectionString() {
    return process.env.AZURE_STORAGE_CONNECTION_STRING;
  }

  async container(containerName: string) {
    try {
      const containerClient = this.baseClient.getContainerClient(containerName);

      return new AzureStorageContainer(containerClient);
    } catch (_) {
      return null;
    }
  }

  async listContainers() {
    const containerNames = [];

    for await (const container of this.baseClient.listContainers()) {
      containerNames.push(container.name);
    }
    return containerNames;
  }
}

/**
 * Configuration for Blob "Archetypes":
 *
 * `path` is the container path that will be prefixed to the blob name, not including a path separator.
 * e.g. the path "logs" for the blob named "log1.txt" will have the full blobName "logs/log1.txt"
 */
export type BlobsConfig = {
  path?: string;
  container: AzureStorageContainer;
  overwrite?: boolean;
  compression?: CompressionAlgorithm;
};

/**
 * Wrapper for Container clients. Used for creating instances of `ContainerBlobs`.
 *
 * @param containerName The name of the container. This will be the path separator in Blob URLs.
 * @param baseClient An instance of the base BlobServiceClient from the official Blob Storage SDK.
 * @param container The ContainerClient to wrap, from the official Blob Storage SDK.
 */
export class AzureStorageContainer {
  constructor(private container: ContainerClient) {}

  createBlobsClient(config: Omit<BlobsConfig, 'container'>): BlobModel {
    return new BlobModel({ ...config, container: this });
  }

  getClient() {
    return this.container;
  }

  async listBlobs(prefix?: RegisteredBlobModel) {
    for await (const blobInfo of this.container.listBlobsFlat(
      prefix && { prefix },
    )) {
      logJson(blobInfo);
    }
  }

  async mapBlobs<T>(
    mapFunc: (item: BlobItem) => T,
    prefix?: RegisteredBlobModel,
  ) {
    const returnVals: T[] = [];

    for await (const blobInfo of this.container.listBlobsFlat(
      prefix && { prefix },
    )) {
      const mappedVal = await mapFunc(blobInfo);

      returnVals.push(mappedVal);
    }

    return returnVals;
  }
}

/**
 * An abstraction to separate different "types" of blobs that are contained
 * within the same container. Each blob "type" will be isolated to their
 * respective subdirectories/paths.
 *
 * It's primary purpose is to take a BlobsConfig and generate `BlobClient`s
 * using the provided config.
 */
export class BlobModel {
  private readonly container: AzureStorageContainer;

  constructor(private readonly config: BlobsConfig) {
    this.container = this.config.container;
  }

  getContainer() {
    return this.container;
  }

  blob(blobName: string, blobType?: AzureBlobType) {
    return new BlobClient(blobName, this.config, blobType);
  }
}

/**
 * A wrapper for `BlobClient` from the official Azure SDK.
 *
 * Prepends the configured "blob type" path and streamlines the functionality
 * to be easier to use and hiding unneeded functionality.
 */
export class BlobClient {
  private readonly path: string = '';
  private readonly container: AzureStorageContainer;
  private overwrite = false;
  readonly blobType: AzureBlobType;
  private compression?: CompressionAlgorithm | void;

  private client: AzureBlobClient;
  private name: string;
  public filename: string;

  constructor(
    blobName: string,
    config: BlobsConfig,
    blobType: AzureBlobType = 'block',
  ) {
    this.path = config.path || '';
    this.container = config.container;
    this.overwrite = !!config.overwrite;
    this.blobType = blobType;

    const blobPath = this.path ? normalize(`${this.path}/${blobName}`) : blobName;

    if (blobType === 'append') {
      this.client = this.container.getClient().getAppendBlobClient(blobPath);
    } else {
      this.client = this.container.getClient().getBlockBlobClient(blobPath);
    }

    this.name = this.client.name;
    this.filename = blobName;

    if (config.compression) {
      this.setCompression(config.compression);
    }

    // if (!this.path) {
    //   throw Error(
    //     'Expected a non-empty path in BlobsConfig, but none was provided.',
    //   );
    // }
  }

  get url() {
    return this.client.url;
  }

  exists() {
    return this.client.exists();
  }

  async getProperties() {
    return this.client.getProperties();
  }

  async getSize() {
    return (await this.client.getProperties()).contentLength || 0;
  }

  async setCacheControl(cacheControl: string) {
    return await this.client.setHTTPHeaders({ blobCacheControl: cacheControl });
  }

  setCompression(algorithm: CompressionAlgorithm | void): BlobClient {
    this.compression = algorithm;

    const compressionExtensions: CompressionAlgorithm[] = ['brotli', 'zstd'];

    const extensionsRegex = new RegExp(
      `\\.(${compressionExtensions.join('|')})$`,
    );

    const extraExtension = algorithm ? `.${algorithm}` : '';

    this.filename = `${this.filename.replace(
      extensionsRegex,
      '',
    )}${extraExtension}`;

    if (this.blobType === 'append') {
      this.client = this.container
        .getClient()
        .getAppendBlobClient(`${this.path}/${this.filename}`);
    } else {
      this.client = this.container
        .getClient()
        .getBlockBlobClient(`${this.path}/${this.filename}`);
    }

    this.name = this.client.name;

    return this;
  }

  async setMetadata(metadata: { [p: string]: string }) {
    await this.client.setMetadata(metadata);
  }

  async sizesAreDifferent(fileSizeBytes: number) {
    if (!(await this.client.exists())) {
      return true;
    }

    const blobSize = await this.getSize();

    return fileSizeBytes !== blobSize;
  }

  async copyFromUrl(sourceUrl: string) {
    const blobExists = await this.client.exists();

    if (blobExists && !this.overwrite) {
      throw Error(
        `Error uploading blob: "${this.name}" already exists and options.overwrite = false`,
      );
    }

    try {
      return await this.client.syncCopyFromURL(sourceUrl);
    } catch (err) {
      console.error(chalk.red('Error copying from url to storage:'));
      console.error((<Error>err).stack);
      return;
    }
  }

  async copyFromUrlIfDifferent(
    sourceUrl: string,
    fileSizeBytes: number,
  ): Promise<BlobBeginCopyFromURLResponse | void> {
    if (await this.sizesAreDifferent(fileSizeBytes)) {
      console.log(`File is new or updated. Uploading: ${this.filename}`);
      return await this.copyFromUrl(sourceUrl);
    }
  }

  async downloadToFile(
    destinationFilePath: string,
    options?: BlobDownloadToBufferOptions & { decompressData?: boolean },
  ) {
    if (!(await this.client.exists())) {
      throw Error(`The requested blob "${this.client.name}" does not exist`);
    }

    if (this.compression && options?.decompressData !== false) {
      const compression = this.compression;

      const opts: BlobDownloadToBufferOptions = {
        blockSize: options?.blockSize || 4_194_304,
        concurrency: options?.concurrency || 20,
        onProgress: options?.onProgress,
      };

      return this.client
        .downloadToBuffer(0, undefined, opts)
        .then((dataBuffer) => decompressString(dataBuffer, compression))
        .then((decompressed) =>
          writeFile(destinationFilePath, decompressed, 'utf-8'),
        )
        .catch((err) => {
          console.error(
            chalk.red('Error downloading and/or decompressing file:'),
          );
          console.error((<Error>err).stack);
        });
    }

    try {
      return await this.client.downloadToFile(
        destinationFilePath,
        0,
        undefined,
        {
          onProgress: (event) => console.log(event),
        },
      );
    } catch (err) {
      console.error(chalk.red('Error uploading string to storage:'));
      console.error((<Error>err).stack);
    }
  }

  async uploadFromFile(filepathToUpload: string) {
    if (!(this.client instanceof BlockBlobClient)) {
      throw Error('copyFromUrl() can only be called on BlockBlobClients');
    }

    const blobExists = await this.client.exists();

    if (blobExists && !this.overwrite) {
      throw Error(
        `Error uploading blob: "${this.name}" already exists and overwrite = false`,
      );
    }

    const fileBytesSize = (await stat(filepathToUpload)).size;
    const progressLogger = makeFileUploadProgressLogger(fileBytesSize);

    if (await this.sizesAreDifferent(fileBytesSize)) {
      try {
        return await this.client.uploadFile(filepathToUpload, {
          onProgress: progressLogger,
        });
      } catch (err) {
        console.error(chalk.red('Error uploading file to storage:'));
        console.error((<Error>err).stack);
      }
    }

    console.log('Files are the same. No changes made.');

    return;
  }

  async uploadFromString(
    string: string,
    options?: BlockBlobParallelUploadOptions & {
      compression?: CompressionAlgorithm;
      logProgress?: boolean;
      overwrite?: boolean;
    },
  ) {
    if (!(this.client instanceof BlockBlobClient)) {
      throw Error('uploadFromString() can only be called on BlockBlobClients');
    }

    const blobExists = await this.client.exists();

    if (blobExists && !this.overwrite && !options?.overwrite) {
      throw Error(
        `Error uploading blob: "${this.name}" already exists and overwrite = false`,
      );
    }

    const compression = options?.compression || this.compression;
    const blockSize = options?.blockSize || 4_194_304;

    const stringBuffer = compression
      ? await compressString(string, compression)
      : Buffer.from(string);

    const fileBytesSize = stringBuffer.byteLength;

    const onProgress = options?.logProgress
      ? { onProgress: makeFileUploadProgressLogger(fileBytesSize) }
      : {};

    if (await this.sizesAreDifferent(fileBytesSize)) {
      try {
        return await this.client.uploadData(stringBuffer, {
          blockSize,
          maxSingleShotSize: options?.maxSingleShotSize,
          ...onProgress,
          concurrency: options?.concurrency,
          blobHTTPHeaders: options?.blobHTTPHeaders,
          metadata: options?.metadata,
          tags: options?.tags,
        });
      } catch (err) {
        console.error(chalk.red('Error uploading string to storage:'));
        console.error((<Error>err).stack);
        throw err;
      }
    }

    console.log('Files are the same. No changes made.');
    return;
  }

  async uploadStream<T extends Readable>(
    stream: T,
    overwrite = this.overwrite,
  ) {
    if (!(this.client instanceof BlockBlobClient)) {
      throw Error('uploadStream() can only be called on BlockBlobClients');
    }

    const blobExists = await this.client.exists();

    if (blobExists && !overwrite) {
      throw Error(
        `Error uploading blob: "${this.name}" already exists and overwrite = false`,
      );
    }

    try {
      return this.client.uploadStream(
        stream,
        1024 * 1024 * 4,
        cpus().length - 1,
        {
          onProgress: console.log,
        },
      );
    } catch (err) {
      console.error(chalk.red('Error uploading stream to storage:'));
      console.error((<Error>err).stack);
      return;
    }
  }

  async downloadToString(
    options?: BlobDownloadToBufferOptions & { decompressData?: boolean },
  ) {
    if (!(await this.client.exists())) {
      throw Error(`The requested blob "${this.client.name}" does not exist`);
    }

    const blockSize = options?.blockSize || 4_194_304;

    try {
      const blobSizeBytes = await this.getSize();

      const destinationBuffer = Buffer.allocUnsafe(blobSizeBytes);

      await this.client.downloadToBuffer(destinationBuffer, 0, undefined, {
        onProgress: (event) => console.log(event),
        blockSize,
        concurrency: options?.concurrency,
      });

      return this.compression && options?.decompressData !== false
        ? await decompressString(destinationBuffer, this.compression)
        : destinationBuffer.toString('utf-8');
    } catch (err) {
      console.error(chalk.red('Error downloading file to string:'));
      console.error((<Error>err).stack);
      return;
    }
  }

  async append(text: string) {
    if (!(this.client instanceof AppendBlobClient)) {
      throw Error('append() can only be called on AppendBlobClients');
    }

    try {
      await this.client.createIfNotExists({
        blobHTTPHeaders: {
          blobContentType: 'text/plain',
          blobContentEncoding: 'UTF-8',
        },
      });

      await this.client.appendBlock(text, Buffer.from(text).byteLength);
    } catch (err) {
      console.error(chalk.red('Error appending to blob: ', this.client.name));
      console.error((<Error>err).stack);
    }
  }

  async delete() {
    try {
      if (await this.client.exists()) {
        await this.client.delete();
      }
    } catch (err) {
      console.error(chalk.red('Error deleting blob: ', this.client.name));
      console.error((<Error>err).stack);
    }
  }
}
