import type { TransferProgressEvent } from '@azure/core-http-compat';
import { throttle } from 'rambdax';
import { bytesToMbs } from '@dua-upd/node-utils';

export const makeFileUploadProgressLogger = (fileSizeBytes: number) => {
  const fileMbs = bytesToMbs(fileSizeBytes);

  return throttle((event: TransferProgressEvent) => {
    const progressMbs = bytesToMbs(event.loadedBytes);

    console.log(
      `${progressMbs}MB / ${fileMbs}MB uploaded – (${Math.round(
        (progressMbs / fileMbs) * 100
      )}% complete)`
    );
  }, 500);
};
