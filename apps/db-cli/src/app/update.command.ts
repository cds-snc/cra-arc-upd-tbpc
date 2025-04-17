import chalk from 'chalk';
import {
  Command,
  CommandRunner,
  InquirerService,
  Option,
  QuestionSet,
  Question,
} from 'nest-commander';
import { DbUpdateService } from '@dua-upd/db-update';
import { DataIntegrityService } from '@dua-upd/data-integrity';

@QuestionSet({ name: 'update' })
export class UpdateQuestions {
  @Question({
    message: 'Perform all updates or Calldrivers only?',
    name: 'target',
    type: 'list',
    choices: ['all', 'calldrivers'],
    default: 'all',
  })
  parseUpdate(str: string): string {
    return str;
  }
}

@QuestionSet({ name: 'skipAirtableUpdates' })
export class SkipAirtableQuestions {
  @Question({
    message: 'Skip airtable updates?',
    name: 'skipAirtableUpdates',
    type: 'list',
    choices: ['No', 'Yes'],
    default: 'No',
  })
  parseSkipAirtableUpdates(str: string): boolean {
    return str === 'Yes';
  }
}

@Command({
  name: 'update',
  description: 'Update the database',
})
export class UpdateCommand extends CommandRunner {
  constructor(
    private readonly inquirerService: InquirerService,
    private dataIntegrityService: DataIntegrityService,
    private dbUpdateService: DbUpdateService,
  ) {
    super();
  }

  async run(inputs: string[], options?: Record<string, any>) {
    const target =
      options?.target ||
      options?.calldrivers ||
      options?.all ||
      (
        await this.inquirerService.prompt<{ target: string }>('update', {
          ...options,
        })
      ).target;

    if (/calldrivers/i.test(target)) {
      await this.dbUpdateService.updateCalldrivers();
      return;
    }

    const skipAirtableUpdates = (
      await this.inquirerService.prompt<{
        skipAirtableUpdates: boolean;
      }>('skipAirtableUpdates', { ...options })
    );

    try {
      await this.dbUpdateService.updateAll(false, skipAirtableUpdates);
      await this.dataIntegrityService.fillMissingData();
      await this.dataIntegrityService.cleanPageUrls();
      await this.dbUpdateService.recalculateViews(false);
    } catch (error) {
      console.error(chalk.red(error.stack));
    }
  }

  @Option({
    flags: '-t, --target <target>',
    description: 'The target for updates (all updates or calldrivers-only)',
  })
  parseTarget(str: string) {
    return str;
  }

  @Option({
    flags: '-a, --all',
    description: 'Set the target for updates to "all"',
    defaultValue: false,
  })
  parseAll(all: boolean) {
    return all && 'all';
  }

  @Option({
    flags: '-cd, --calldrivers',
    description: 'Set the target for updates to "calldrivers"',
    defaultValue: false,
  })
  parseCalldrivers(calldrivers: boolean) {
    return calldrivers && 'calldrivers';
  }
}
