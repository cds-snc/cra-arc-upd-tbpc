/**
 * Tests for the unified storage client (Azure & S3)
 */

import fs from 'fs/promises';
import path from 'path';
import {
  StorageClient,
  type BlobClient,
  type BlobModel,
  type StorageContainer,
} from './storage.client';

describe.each(['azure', 's3'] as const)('StorageClient - %s', (storageType) => {
  let storageClient: StorageClient;
  const testContainerName = 'upd-test-bucket';
  const testObjectName = 'test-object.txt';
  const testContent = 'Hello, storage world!';

  beforeAll(async () => {
    storageClient = new StorageClient(storageType);
  });

  describe('Container operations', () => {
    test('should get container client', async () => {
      const container = await storageClient.container(testContainerName);
      expect(container).toBeDefined();
    });

    test('should list containers/buckets', async () => {
      const containers = await storageClient.listContainers();
      expect(Array.isArray(containers)).toBe(true);
    });
  });

  describe('Object/Blob operations', () => {
    let container: StorageContainer;
    let blobModel: BlobModel;
    let blobClient: BlobClient;

    beforeAll(async () => {
      container = await storageClient.container(testContainerName);
      blobModel = container.createBlobsClient({ path: 'test' });
      blobClient = blobModel.blob(testObjectName);
    });

    test('should upload string content', async () => {
      await expect(
        blobClient.uploadFromString(testContent, { overwrite: true }),
      ).resolves.not.toThrow();
    });

    test('should check if object exists', async () => {
      const exists = await blobClient.exists();
      expect(typeof exists).toBe('boolean');
    });

    test('should get object properties', async () => {
      if (await blobClient.exists()) {
        const properties = await blobClient.getProperties();
        expect(properties).toBeDefined();
        expect(properties.lastModified).toBeDefined();
      }
    });

    test('should download string content', async () => {
      if (await blobClient.exists()) {
        const content = await blobClient.downloadToString();
        expect(content).toBe(testContent);
      }
    });

    test('should delete object', async () => {
      if (await blobClient.exists()) {
        await expect(blobClient.delete()).resolves.not.toThrow();
      }
    });
  });

  describe('File operations', () => {
    let container: StorageContainer;
    let blobModel: BlobModel;
    let blobClient: BlobClient;

    const testFilePath = path.join(__dirname, 'test-file.txt');

    beforeAll(async () => {
      container = await storageClient.container(testContainerName);
      blobModel = container.createBlobsClient({ path: 'test-files' });
      blobClient = blobModel.blob('uploaded-file.txt');

      // Create a test file
      await fs.writeFile(testFilePath, 'Test file content for upload');
    });

    afterAll(async () => {
      // Clean up test file
      try {
        await fs.unlink(testFilePath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    });

    test('should upload file', async () => {
      await expect(
        blobClient.uploadFromFile(testFilePath),
      ).resolves.not.toThrow();
    });

    test('should download file', async () => {
      const downloadPath = path.join(__dirname, 'downloaded-file.txt');

      if (await blobClient.exists()) {
        await expect(
          blobClient.downloadToFile(downloadPath),
        ).resolves.not.toThrow();

        // Verify downloaded content
        const content = await fs.readFile(downloadPath, 'utf-8');
        expect(content).toBe('Test file content for upload');

        // Clean up
        await fs.unlink(downloadPath);
      }
    });

    test('should clean up uploaded file', async () => {
      if (await blobClient.exists()) {
        await expect(blobClient.delete()).resolves.not.toThrow();
      }
    });
  });

  describe('Compression support', () => {
    let container: StorageContainer;
    let blobModel: BlobModel;
    let blobClient: BlobClient;

    beforeAll(async () => {
      container = await storageClient.container(testContainerName);
      blobModel = container.createBlobsClient({
        path: 'compressed',
        compression: 'zstd',
      });
      blobClient = blobModel.blob('compressed-test.txt');
    });

    test('should upload compressed content', async () => {
      const largeContent =
        'This is a large text content that should be compressed. '.repeat(100);

      await expect(
        blobClient.uploadFromString(largeContent, {
          overwrite: true,
          compression: 'zstd',
        }),
      ).resolves.not.toThrow();
    });

    test('should download and decompress content', async () => {
      if (await blobClient.exists()) {
        const content = await blobClient.downloadToString({
          decompressData: true,
        });
        expect(content).toContain(
          'This is a large text content that should be compressed.',
        );
      }
    });

    test('should clean up compressed file', async () => {
      if (await blobClient.exists()) {
        await expect(blobClient.delete()).resolves.not.toThrow();
      }
    });
  });

  describe('Metadata operations', () => {
    let container: StorageContainer;
    let blobModel: BlobModel;
    let blobClient: BlobClient;

    beforeEach(async () => {
      container = await storageClient.container(testContainerName);
      blobModel = container.createBlobsClient({ path: 'metadata-test' });
      blobClient = blobModel.blob('metadata-object.txt');

      await blobClient.uploadFromString('Initial content', {
        overwrite: true,
        metadata: {
          'initial': 'initial',
          environment: 'test',
        },
      });
    });

    afterAll(async () => {
      // Clean up metadata test file
      if (await blobClient.exists()) {
        await blobClient.delete();
      }
    });

    test('should upload with metadata', async () => {
      await expect(
        blobClient.uploadFromString('Content with metadata', {
          overwrite: true,
          metadata: {
            'key': 'value',
            environment: 'test',
          },
        }),
      ).resolves.not.toThrow();
    });

    test('should set metadata after upload', async () => {
      if (await blobClient.exists()) {
        await expect(
          blobClient.setMetadata({
            'updated': 'updated',
          }),
        ).resolves.not.toThrow();
      }
    });
  });
});

describe.skip('Environment variables', () => {
  test('azure - should throw when no storage credentials are configured', () => {
    const originalAzure = process.env.AZURE_STORAGE_CONNECTION_STRING;

    delete process.env.AZURE_STORAGE_CONNECTION_STRING;

    console.log(process.env.AZURE_STORAGE_CONNECTION_STRING);

    expect(() => new StorageClient('azure')).toThrow();

    // Restore
    if (originalAzure) {
      process.env.AZURE_STORAGE_CONNECTION_STRING = originalAzure;
    }
  });

  test('s3 - should throw when no storage credentials are configured', () => {
    const originalAws = process.env.AWS_ACCESS_KEY_ID;
    const originalSecret = process.env.AWS_SECRET_ACCESS_KEY;

    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    console.log(process.env.AWS_ACCESS_KEY_ID);
    console.log(process.env.AWS_SECRET_ACCESS_KEY);

    expect(() => new StorageClient('s3')).toThrow();

    // Restore
    if (originalAws) {
      process.env.AWS_ACCESS_KEY_ID = originalAws;
    } else {
      delete process.env.AWS_ACCESS_KEY_ID;
    }
    if (originalSecret) {
      process.env.AWS_SECRET_ACCESS_KEY = originalSecret;
    } else {
      delete process.env.AWS_SECRET_ACCESS_KEY;
    }
  });
});
