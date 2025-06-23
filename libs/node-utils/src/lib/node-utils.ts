import { Buffer } from 'buffer';
import {
  compress as compressZstd,
  decompress as decompressZstd,
} from '@mongodb-js/zstd';
import * as brotli from 'brotli-wasm';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';

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
