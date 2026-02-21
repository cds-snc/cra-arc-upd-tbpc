import { Buffer } from 'buffer';
import {
  compress as compressZstd,
  decompress as decompressZstd,
} from '@mongodb-js/zstd';
import * as brotli from 'brotli-wasm';
import { createHash } from 'node:crypto';
import {
  createGunzip,
  createZstdCompress,
  createZstdDecompress,
  constants as zstdConstants,
} from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { type ReadableStream, TextDecoderStream } from 'node:stream/web';
import { Duplex, Readable } from 'node:stream';
import { default as StreamArray } from 'stream-json/streamers/StreamArray';

const compressBrotli = brotli.compress;
const decompressBrotli = brotli.decompress;

export const bytesToMbs = (bytes: number) => Math.round(bytes / 10) / 100000;

export type CompressionAlgorithm = 'brotli' | 'zstd';

export const compressStringBrotli = async (string: string) => {
  const stringBuffer = Buffer.from(string);

  return Buffer.from(compressBrotli(new Uint8Array(stringBuffer)));
};

export const compressStringZstd = async (string: string, level = 9) => {
  const stringBuffer = Buffer.from(string);

  return await compressZstd(stringBuffer, level);
};

export const compressString = async (
  string: string | Buffer,
  algorithm: CompressionAlgorithm = 'zstd',
) => {
  const stringBuffer = string instanceof Buffer ? string : Buffer.from(string);

  switch (algorithm) {
    case 'brotli':
      return Buffer.from(compressBrotli(new Uint8Array(stringBuffer)));
    case 'zstd':
      return Buffer.from((await compressZstd(stringBuffer)).buffer);
    default:
      return Buffer.from((await compressZstd(stringBuffer)).buffer);
  }
};

export const decompressStringBrotli = async (compressed: Buffer) =>
  Buffer.from(decompressBrotli(new Uint8Array(compressed))).toString('utf-8');

export const decompressStringZstd = async (compressed: Buffer) =>
  (await decompressZstd(compressed)).toString('utf-8');

export const decompressString = async (
  string: string | Buffer,
  algorithm: CompressionAlgorithm = 'zstd',
) => {
  const stringBuffer = string instanceof Buffer ? string : Buffer.from(string);

  switch (algorithm) {
    case 'brotli':
      return Buffer.from(
        decompressBrotli(new Uint8Array(stringBuffer)),
      ).toString('utf-8');
    case 'zstd':
      return (await decompressZstd(stringBuffer)).toString('utf-8');
    default:
      return (await decompressZstd(stringBuffer)).toString('utf-8');
  }
};

export const md5Hash = (target: string | object) =>
  createHash('md5')
    .update(typeof target === 'string' ? target : JSON.stringify(target))
    .digest('hex');

export const gunzip = (buffer: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    const gunzip = createGunzip();
    const chunks: Buffer[] = [];

    gunzip.on('data', (chunk) => chunks.push(chunk));
    gunzip.on('end', () => resolve(Buffer.concat(chunks)));
    gunzip.on('error', (err) => reject(err));

    gunzip.write(buffer);
    gunzip.end();
  });

export const writeCompressedStream = async <
  T extends Readable | ReadableStream,
>(
  outputPath: string,
  input: T,
) => {
  const inputStream =
    input instanceof Readable ? input : Readable.fromWeb(input);

  const outputStream = createWriteStream(outputPath);
  const compressStream = createZstdCompress({
    params: {
      [zstdConstants.ZSTD_c_compressionLevel]: 3,
      [zstdConstants.ZSTD_c_strategy]: zstdConstants.ZSTD_lazy2,
    },
  });

  return await pipeline(inputStream, compressStream, outputStream);
};

export const readCompressedStream = async (inputPath: string) => {
  const inputStream = createReadStream(inputPath);
  const decompressStream = createZstdDecompress();
  const reader = (Readable.toWeb(inputStream) as ReadableStream<Uint8Array>)
    .pipeThrough(Duplex.toWeb(decompressStream))
    .getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf-8');
};

type TopLevelJson = unknown[];
type JsonReviver = (key: string, value: unknown) => unknown;
type ReadCompressedJsonStreamConfig = {
  reviver?: JsonReviver;
  limit?: number;
  // filter?: (value: unknown) => boolean; // add later if needed
};

/**
 * Reads a compressed JSON array from the specified path, decompresses it using Zstd, and parses it using a streaming parser.
 * The function returns a promise that resolves to the parsed JSON data.
 * An optional reviver function can be provided to transform the parsed values.
 *
 * Assumes that the JSON file is an array of items, and processes each item in a streaming fashion to handle large files efficiently.
 *
 * @param inputPath - The file path to the compressed JSON file.
 * @param config - Optional configuration object that can include a reviver function for transforming parsed values and a limit on the number of items to read.
 * @returns A promise that resolves to the parsed JSON data, potentially transformed by the reviver function.
 */
export const readCompressedJsonStream = async <T extends TopLevelJson>(
  inputPath: string,
  config?: ReadCompressedJsonStreamConfig,
): Promise<T> => {
  const inputStream = createReadStream(inputPath);
  const decompressStream = createZstdDecompress();
  const reader = Readable.toWeb(inputStream)
    .pipeThrough(Duplex.toWeb(decompressStream))
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(StreamArray.toWeb(StreamArray.withParser()));

  const items: unknown[] = [];

  const streamReader = reader.getReader();

  while (true) {
    const { done, value } = await streamReader.read();

    if (done) break;

    items.push(value.value);

    // stop reading more data if limit is reached
    if (config?.limit && items.length >= config.limit) {
      break;
    }
  }

  const runReviver = (obj: unknown) => {
    for (const key in obj as object) {
      obj[key] = config?.reviver ? config.reviver(key, obj[key]) : obj[key];
    }
    return obj;
  };

  return config?.reviver
    ? (items.map((item) => runReviver(item)) as T)
    : (items as T);
};
