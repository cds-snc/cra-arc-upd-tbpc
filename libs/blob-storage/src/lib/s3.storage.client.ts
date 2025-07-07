/**
 * Building blocks for an ORM-like wrapper for AWS S3 Storage
 *
 * Main purposes for the abstraction are:
 * - Abstract away lower-level details of configuring and interacting with S3 Storage
 * - Enforce a "registry" for S3 Buckets and "Object Models" to prevent overlap of bucket names and/or paths
 * - Expose the base functionality for upload/download/etc. as well as configuration and create
 *      an environment to extend and build on that functionality for specific use-cases
 * - Maintain interface compatibility with Azure Blob Storage client for easy drop-in replacement
 */

import type { Readable } from 'stream';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListBucketsCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import chalk from 'chalk';
import { stat, writeFile } from 'fs/promises';
import { logJson } from '@dua-upd/utils-common';
import { Buffer } from 'buffer';
import {
  CompressionAlgorithm,
  compressString,
  decompressString,
} from '@dua-upd/node-utils';
import { RegisteredBlobModel } from './storage.service';
import { normalize } from 'path/posix';

/**
 * The base client for connecting to S3 storage. Wraps the official AWS S3 client.
 * Used to initialize a client with the proper credentials and for creating
 * or managing bucket clients.
 */
export class S3StorageClient {
  private readonly baseClient: S3Client;

  constructor(credentials?: S3ClientConfig['credentials']) {
    if (
      !credentials &&
      !process.env.AWS_ACCESS_KEY_ID &&
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      throw new Error(
        'No AWS credentials provided. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables or pass credentials',
      );
    }

    const region =
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      'ca-central-1';

    const clientConfig: S3ClientConfig = {
      region,
      credentials,
    };

    // Add custom endpoint if specified (for S3-compatible services)
    if (process.env.AWS_ENDPOINT_URL || process.env.S3_ENDPOINT) {
      clientConfig.endpoint =
        process.env.AWS_ENDPOINT_URL || process.env.S3_ENDPOINT;
    }

    // Force path style for S3-compatible services like MinIO
    if (process.env.S3_FORCE_PATH_STYLE === 'true') {
      clientConfig.forcePathStyle = true;
    }

    // AWS SDK will automatically detect credentials from environment variables:
    // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_PROFILE, etc.

    this.baseClient = new S3Client(clientConfig);
  }

  async bucket(bucketName: string) {
    try {
      // Check if bucket exists
      await this.baseClient.send(new HeadBucketCommand({ Bucket: bucketName }));

      return new S3Bucket(this.baseClient, bucketName);
    } catch (error) {
      console.error(`Bucket ${bucketName} not accessible:`, error);
      return null;
    }
  }

  // For compatibility with Azure BlobClient
  get container() {
    return this.bucket.bind(this);
  }

  async listBuckets() {
    const command = new ListBucketsCommand({});
    const response = await this.baseClient.send(command);
    return response.Buckets?.map((bucket) => bucket.Name || '') || [];
  }

  // For compatibility with Azure BlobClient
  get listContainers() {
    return this.listBuckets.bind(this);
  }
}

/**
 * Configuration for S3 Object "Archetypes":
 *
 * `path` is the bucket path that will be prefixed to the object key, not including a path separator.
 * e.g. the path "logs" for the object named "log1.txt" will have the full key "logs/log1.txt"
 */
export type S3ObjectConfig = {
  path?: string;
  container: S3Bucket;
  overwrite?: boolean;
  compression?: CompressionAlgorithm;
};

/**
 * Wrapper for S3 Bucket clients. Used for creating instances of `S3ObjectModel`.
 * Maps to Azure's AzureStorageContainer functionality.
 */
export class S3Bucket {
  constructor(
    private readonly client: S3Client,
    public readonly bucketName: string,
  ) {}

  createBlobsClient(config: Omit<S3ObjectConfig, 'container'>): S3ObjectModel {
    return new S3ObjectModel({ ...config, container: this });
  }

  getClient() {
    return this.client;
  }

  async listBlobs(prefix?: RegisteredBlobModel) {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix || undefined,
    });

    try {
      const response = await this.client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          logJson({
            name: obj.Key,
            lastModified: obj.LastModified,
            size: obj.Size,
            etag: obj.ETag,
          });
        }
      }
    } catch (error) {
      console.error('Error listing objects:', error);
    }
  }

  async mapBlobs<T>(mapFunc: (item: any) => T, prefix?: RegisteredBlobModel) {
    const returnVals: T[] = [];
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix || undefined,
    });

    try {
      let continuationToken: string | undefined;

      do {
        if (continuationToken) {
          command.input.ContinuationToken = continuationToken;
        }

        const response = await this.client.send(command);

        if (response.Contents) {
          for (const obj of response.Contents) {
            const mappedVal = await mapFunc({
              name: obj.Key,
              lastModified: obj.LastModified,
              size: obj.Size,
              etag: obj.ETag,
            });

            returnVals.push(mappedVal);
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
    } catch (error) {
      console.error('Error mapping objects:', error);
    }

    return returnVals;
  }
}

/**
 * An abstraction to separate different "types" of objects that are contained
 * within the same bucket. Each object "type" will be isolated to their
 * respective subdirectories/paths.
 *
 * Maps to Azure's BlobModel functionality.
 */
export class S3ObjectModel {
  private readonly container: S3Bucket;

  constructor(private readonly config: S3ObjectConfig) {
    this.container = this.config.container;
  }

  getContainer() {
    return this.container;
  }

  blob(objectName: string) {
    return new S3ObjectClient(objectName, this.config);
  }
}

/**
 * A wrapper for S3 operations that maintains compatibility with Azure BlobClient.
 *
 * Prepends the configured "object type" path and streamlines the functionality
 * to be easier to use and hiding unneeded functionality.
 */
export class S3ObjectClient {
  private readonly path: string = '';
  private readonly container: S3Bucket;
  private overwrite = false;
  private compression?: CompressionAlgorithm | void;

  private objectKey: string;
  private name: string;
  public filename: string;

  constructor(objectName: string, config: S3ObjectConfig) {
    this.path = config.path || '';
    this.container = config.container;
    this.overwrite = !!config.overwrite;

    const objectPath = this.path
      ? normalize(`${this.path}/${objectName}`)
      : objectName;
      
    this.objectKey = objectPath;
    this.name = objectPath;
    this.filename = objectName;

    if (config.compression) {
      this.setCompression(config.compression);
    }
  }

  get url() {
    const region = process.env.AWS_REGION || 'ca-central-1';
    return `https://${this.container.bucketName}.s3.${region}.amazonaws.com/${this.objectKey}`;
  }

  async exists() {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.container.bucketName,
        Key: this.objectKey,
      });

      await this.container.getClient().send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getProperties() {
    const command = new HeadObjectCommand({
      Bucket: this.container.bucketName,
      Key: this.objectKey,
    });

    try {
      const response = await this.container.getClient().send(command);
      return {
        lastModified: response.LastModified,
        contentLength: response.ContentLength,
        etag: response.ETag,
        contentType: response.ContentType,
        metadata: response.Metadata || {},
        // Map other properties as needed to maintain Azure compatibility
      };
    } catch (error) {
      throw new Error(`Failed to get object properties: ${error}`);
    }
  }

  async getSize() {
    try {
      const properties = await this.getProperties();
      return properties.contentLength || 0;
    } catch (error) {
      return 0;
    }
  }

  async setCacheControl(cacheControl: string) {
    // S3 requires copying the object to itself to update metadata
    const copyCommand = new CopyObjectCommand({
      Bucket: this.container.bucketName,
      CopySource: `${this.container.bucketName}/${this.objectKey}`,
      Key: this.objectKey,
      CacheControl: cacheControl,
      MetadataDirective: 'REPLACE',
    });

    return await this.container.getClient().send(copyCommand);
  }

  setCompression(algorithm: CompressionAlgorithm | void): S3ObjectClient {
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

    // Update object key with new filename
    this.objectKey = this.path
      ? `${this.path}/${this.filename}`
      : this.filename;
    this.name = this.objectKey;

    return this;
  }

  async setMetadata(metadata: { [p: string]: string }) {
    // S3 requires copying the object to itself to update metadata
    const copyCommand = new CopyObjectCommand({
      Bucket: this.container.bucketName,
      CopySource: `${this.container.bucketName}/${this.objectKey}`,
      Key: this.objectKey,
      Metadata: metadata,
      MetadataDirective: 'REPLACE',
    });

    await this.container.getClient().send(copyCommand);
  }

  async sizesAreDifferent(fileSizeBytes: number) {
    if (!(await this.exists())) {
      return true;
    }

    const objectSize = await this.getSize();
    return fileSizeBytes !== objectSize;
  }

  async copyFromUrl(sourceUrl: string) {
    const objectExists = await this.exists();

    if (objectExists && !this.overwrite) {
      throw Error(
        `Error uploading object: "${this.name}" already exists and options.overwrite = false`,
      );
    }

    try {
      // For S3, we need to handle external URLs differently
      // This is a simplified implementation - you might need to fetch and upload
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.arrayBuffer();

      const command = new PutObjectCommand({
        Bucket: this.container.bucketName,
        Key: this.objectKey,
        Body: new Uint8Array(data),
      });

      return await this.container.getClient().send(command);
    } catch (err) {
      console.error(chalk.red('Error copying from url to storage:'));
      console.error((<Error>err).stack);
      return;
    }
  }

  async copyFromUrlIfDifferent(
    sourceUrl: string,
    fileSizeBytes: number,
  ): Promise<any> {
    if (await this.sizesAreDifferent(fileSizeBytes)) {
      console.log(`File is new or updated. Uploading: ${this.filename}`);
      return await this.copyFromUrl(sourceUrl);
    }
  }

  async downloadToFile(
    destinationFilePath: string,
    options?: {
      decompressData?: boolean;
      blockSize?: number;
      concurrency?: number;
    },
  ) {
    if (!(await this.exists())) {
      throw Error(`The requested object "${this.objectKey}" does not exist`);
    }

    if (this.compression && options?.decompressData !== false) {
      const compression = this.compression;

      const command = new GetObjectCommand({
        Bucket: this.container.bucketName,
        Key: this.objectKey,
      });

      try {
        const response = await this.container.getClient().send(command);

        if (response.Body) {
          const chunks: Uint8Array[] = [];
          const reader = response.Body.transformToWebStream().getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          const dataBuffer = Buffer.concat(chunks);
          const decompressed = await decompressString(dataBuffer, compression);

          return writeFile(destinationFilePath, decompressed, 'utf-8');
        }
      } catch (err) {
        console.error(
          chalk.red('Error downloading and/or decompressing file:'),
        );
        console.error((<Error>err).stack);
        throw err;
      }
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.container.bucketName,
        Key: this.objectKey,
      });

      const response = await this.container.getClient().send(command);

      if (response.Body) {
        const chunks: Uint8Array[] = [];
        const reader = response.Body.transformToWebStream().getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const dataBuffer = Buffer.concat(chunks);
        return writeFile(destinationFilePath, dataBuffer);
      }
    } catch (err) {
      console.error(chalk.red('Error downloading file to storage:'));
      console.error((<Error>err).stack);
      throw err;
    }
  }

  async uploadFromFile(filepathToUpload: string) {
    const objectExists = await this.exists();

    if (objectExists && !this.overwrite) {
      throw Error(
        `Error uploading object: "${this.name}" already exists and overwrite = false`,
      );
    }

    const fileBytesSize = (await stat(filepathToUpload)).size;

    if (await this.sizesAreDifferent(fileBytesSize)) {
      try {
        // Use streaming upload for larger files
        if (fileBytesSize > 100 * 1024 * 1024) {
          // 100MB threshold
          const fs = await import('fs');
          const fileStream = fs.createReadStream(filepathToUpload);

          const upload = new Upload({
            client: this.container.getClient(),
            params: {
              Bucket: this.container.bucketName,
              Key: this.objectKey,
              Body: fileStream,
            },
          });

          return await upload.done();
        } else {
          // Use simple upload for smaller files
          const fileData = await import('fs/promises').then((fs) =>
            fs.readFile(filepathToUpload),
          );

          const command = new PutObjectCommand({
            Bucket: this.container.bucketName,
            Key: this.objectKey,
            Body: fileData,
          });

          return await this.container.getClient().send(command);
        }
      } catch (err) {
        console.error(chalk.red('Error uploading file to storage:'));
        console.error((<Error>err).stack);
        throw err;
      }
    }

    console.log('Files are the same. No changes made.');
    return;
  }

  async uploadFromString(
    string: string,
    options?: {
      compression?: CompressionAlgorithm;
      logProgress?: boolean;
      overwrite?: boolean;
      metadata?: { [key: string]: string };
      tags?: { [key: string]: string };
    },
  ) {
    const objectExists = await this.exists();

    if (objectExists && !this.overwrite && !options?.overwrite) {
      throw Error(
        `Error uploading object: "${this.name}" already exists and overwrite = false`,
      );
    }

    const compression = options?.compression || this.compression;

    const stringBuffer = compression
      ? await compressString(string, compression)
      : Buffer.from(string);

    const fileBytesSize = stringBuffer.byteLength;

    if (await this.sizesAreDifferent(fileBytesSize)) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.container.bucketName,
          Key: this.objectKey,
          Body: stringBuffer,
          Metadata: options?.metadata,
          // S3 uses Tags differently than Azure metadata
          ...(options?.tags && {
            Tagging: Object.entries(options.tags)
              .map(([k, v]) => `${k}=${v}`)
              .join('&'),
          }),
        });

        return await this.container.getClient().send(command);
      } catch (err) {
        console.error(chalk.red('Error uploading string to storage:'));
        console.error((<Error>err).stack);
        return;
      }
    }

    console.log('Files are the same. No changes made.');
    return;
  }

  async uploadStream<T extends Readable>(
    stream: T,
    overwrite = this.overwrite,
  ) {
    const objectExists = await this.exists();

    if (objectExists && !overwrite) {
      throw Error(
        `Error uploading object: "${this.name}" already exists and overwrite = false`,
      );
    }

    try {
      // Use Upload class for proper streaming
      const upload = new Upload({
        client: this.container.getClient(),
        params: {
          Bucket: this.container.bucketName,
          Key: this.objectKey,
          Body: stream,
        },
      });

      return await upload.done();
    } catch (err) {
      console.error(chalk.red('Error uploading stream to storage:'));
      console.error((<Error>err).stack);
      return;
    }
  }

  async downloadToString(options?: {
    decompressData?: boolean;
    blockSize?: number;
    concurrency?: number;
  }) {
    if (!(await this.exists())) {
      throw Error(`The requested object "${this.objectKey}" does not exist`);
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.container.bucketName,
        Key: this.objectKey,
      });

      const response = await this.container.getClient().send(command);

      if (response.Body) {
        const chunks: Uint8Array[] = [];
        const reader = response.Body.transformToWebStream().getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const destinationBuffer = Buffer.concat(chunks);

        return this.compression && options?.decompressData !== false
          ? await decompressString(destinationBuffer, this.compression)
          : destinationBuffer.toString('utf-8');
      }
    } catch (err) {
      console.error(chalk.red('Error downloading file to string:'));
      console.error((<Error>err).stack);
      return;
    }
  }

  async append(text: string) {
    // S3 doesn't support true append operations like Azure Append Blobs
    // We simulate this by downloading, appending, and re-uploading
    // Note: This is not atomic and not efficient for large files
    console.warn('S3 append operation is simulated and not atomic');

    try {
      let existingContent = '';

      if (await this.exists()) {
        existingContent = (await this.downloadToString()) || '';
      }

      const newContent = existingContent + text;

      await this.uploadFromString(newContent, { overwrite: true });
    } catch (err) {
      console.error(chalk.red('Error appending to object: ', this.objectKey));
      console.error((<Error>err).stack);
    }
  }

  async delete() {
    try {
      if (await this.exists()) {
        const command = new DeleteObjectCommand({
          Bucket: this.container.bucketName,
          Key: this.objectKey,
        });

        await this.container.getClient().send(command);
      }
    } catch (err) {
      console.error(chalk.red('Error deleting object: ', this.objectKey));
      console.error((<Error>err).stack);
    }
  }
}
