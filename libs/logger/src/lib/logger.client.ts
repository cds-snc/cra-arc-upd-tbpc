import { LogLevel } from '@nestjs/common';
import type { IStorageBlob, IStorageModel } from '@dua-upd/blob-storage';
import { CustomLogger } from './logger.custom';

// "Targets" in this context means:
//  which log file should each log level write to?
export type LogLevelTargets = { [key in LogLevel]?: string };

export interface BlobLoggerConfig {
  context?: string;
  logLevelTargets: LogLevelTargets;
}
export interface ClassBlobLoggerConfig extends BlobLoggerConfig {
  blobModel: IStorageModel<any>;
}

export class BlobLogger extends CustomLogger {
  private blobModel: IStorageModel<any>;
  private logLevelTargets: LogLevelTargets;
  private targetBlobs: { [key in LogLevel]?: IStorageBlob } = {};

  constructor(config: ClassBlobLoggerConfig) {
    super(config.context);

    this.blobModel = config.blobModel;
  }

  disableBlobLogging() {
    this.logLevelTargets = {};
    this.targetBlobs = {};
  }

  setLogLevelTargets(logLevelTargets: LogLevelTargets) {
    this.logLevelTargets = logLevelTargets;

    const newTargetBlobs: { [key in LogLevel]?: IStorageBlob } = {};

    for (const [level, target] of Object.entries(this.logLevelTargets)) {
      newTargetBlobs[level] = this.blobModel.blob(target, 'append');
    }

    this.targetBlobs = newTargetBlobs;
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, ...text: unknown[]) {
    super.log(message, ...text);

    const mergedMessage = `${message} ${text.join(' ')}`;

    const formattedMessage = this.toFormat(mergedMessage, this.context, 'log');

    this.targetBlobs['log']?.append(formattedMessage).catch((err) => {
      super.error(
        `Error writing to log file (${this.targetBlobs['log'].filename})`
      );
      super.error(err.message, err.stack);
    });
  }

  info(message: string, ...text: unknown[]) {
    super.info(message, ...text);

    const mergedMessage = `${message} ${text.join(' ')}`;

    const formattedMessage = this.toFormat(mergedMessage, this.context, 'log');

    this.targetBlobs['log']?.append(formattedMessage).catch((err) => {
      super.error(
        `Error writing to log file (${this.targetBlobs['log'].filename})`
      );
      super.error(err.message, err.stack);
    });
  }

  accent(message: string, ...text: unknown[]) {
    super.accent(message, ...text);

    const mergedMessage = `${message} ${text.join(' ')}`;

    const formattedMessage = this.toFormat(mergedMessage, this.context, 'log');

    this.targetBlobs['log']?.append(formattedMessage).catch((err) => {
      super.error(
        `Error writing to log file (${this.targetBlobs['log'].filename})`
      );
      super.error(err.message, err.stack);
    });
  }

  error(message: unknown) {
    super.error(message + '\n');

    const formattedMessage = this.toFormat(
      message + '\n',
      this.context,
      'error'
    );

    this.targetBlobs['error']?.append(formattedMessage).catch((err) => {
      super.error(
        `Error writing to log file (${this.targetBlobs['error'].filename})`
      );
      super.error(err.message, err.stack);
    });
  }

  warn(message: string, ...text: unknown[]) {
    super.warn(message, ...text);

    const mergedMessage = `${message} ${text.join(' ')}`;

    const formattedMessage = this.toFormat(mergedMessage, this.context, 'warn');

    this.targetBlobs['warn']?.append(formattedMessage).catch((err) => {
      super.error(
        `Error writing to log file (${this.targetBlobs['warn'].filename})`
      );
      super.error(err.message, err.stack);
    });
  }
}
