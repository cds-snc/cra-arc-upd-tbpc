import { Inject } from '@nestjs/common';
import chalk from 'chalk';
import {
  Command,
  CommandRunner,
  InquirerService,
  Option,
} from 'nest-commander';
import { BlobStorageService } from '@dua-upd/blob-storage';
import { DataIntegrityService } from '@dua-upd/data-integrity';
import { DbService } from '@dua-upd/db';
import { DbUpdateService, ReadabilityService, UrlsService } from '@dua-upd/db-update';
import { LoggerService } from '@dua-upd/logger';
import * as scripts from './scripts';
import { ModuleRef } from '@nestjs/core';
import { TypeOrToken } from './scripts/utils/misc';
import { FeedbackService } from '@dua-upd/api/feedback';

// Use this interface to add any other dependencies to be passed as args
export type DbScript<Args extends unknown[] = unknown[]> = (
  db: DbService,
  ...args: Args
) => Promise<void>;

@Command({
  name: 'run-script',
  description: 'Run a db script from the "scripts" directory',
})
export class RunScriptCommand extends CommandRunner {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly inquirerService: InquirerService,
    private readonly dataIntegrityService: DataIntegrityService,
    private readonly dbUpdateService: DbUpdateService,
    private readonly db: DbService,
    private readonly logger: LoggerService,
    @Inject(BlobStorageService.name) private readonly blob: BlobStorageService,
    private readonly urlService: UrlsService,
    private readonly readability: ReadabilityService,
    private readonly feedbackService: FeedbackService
  ) {
    super();
  }

  inject<ReturnType>(
    typeOrToken: TypeOrToken
  ): ReturnType {
    return this.moduleRef.get(typeOrToken, { strict: false });
  }

  // Note the script you want to run should be the default export of the file
  async runScript(scriptName: keyof typeof scripts) {
    const scriptDependencies: Parameters<DbScript> = [
      this.db,
      this.dbUpdateService,
      this.logger,
      this.blob,
      this.urlService,
      this.readability,
      this.feedbackService
    ];

    try {
      await scripts[scriptName].apply(this, scriptDependencies);

      console.log(`\r\n${chalk.green('Done!')} 👾`);
    } catch (err) {
      console.error(
        chalk.red(`\r\nError running script '${scriptName}' 😿\r\n`)
      );
      console.error(
        chalk.red('You might have forgotten to export it from index.ts\r\n')
      );
      console.error(chalk.red(err.stack));
    }
  }

  async scriptSelectPrompt() {
    const question = {
      type: 'list',
      name: 'scriptName',
      choices: Object.keys(scripts),
      message: '👇 Choose a script to run 👇',
    };

    const selection = await this.inquirerService.inquirer.prompt([question]);

    return selection?.scriptName || '';
  }

  async run(inputs: string[], options?: Record<string, string>) {
    const scriptName = options?.name || (await this.scriptSelectPrompt());

    if (!scriptName) {
      throw Error(
        `Script "${scriptName}" not found. Export it from 'scripts/index.ts'`
      );
    }

    return await this.runScript(scriptName);
  }

  @Option({
    flags: '-n, --name <name>',
    description: 'The filename of the script to run',
  })
  parseName(str: string) {
    return str;
  }
}
