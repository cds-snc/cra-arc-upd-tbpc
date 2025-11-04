import type { TransferProgressEvent } from '@azure/core-http-compat';
import { throttle } from 'rambdax';
import { bytesToMbs } from '@dua-upd/node-utils';

export const makeFileUploadProgressLogger = (fileSizeBytes: number) => {
  const fileMbs = bytesToMbs(fileSizeBytes);

  return throttle((event: TransferProgressEvent) => {
    const progressMbs = bytesToMbs(event.loadedBytes);

    console.log(
      `${progressMbs}MB / ${fileMbs}MB uploaded – (${Math.round(
        (progressMbs / fileMbs) * 100,
      )}% complete)`,
    );
  }, 500);
};

export const escapeURLPath = (url: string) =>
  encodeURIComponent(url)
    .replace(/%2F/g, '/') // Don't escape for "/"
    .replace(/'/g, '%27') // Escape for "'"
    .replace(/\+/g, '%20')
    .replace(/%25/g, '%'); // Revert encoded "%";

export const escapeURL = (url: string) => {
  const urlParsed = new URL(url);

  urlParsed.pathname = escapeURLPath(urlParsed.pathname || '/');

  return urlParsed.toString();
};
