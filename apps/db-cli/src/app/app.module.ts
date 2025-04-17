import { Module, ConsoleLogger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataIntegrityModule } from '@dua-upd/data-integrity';
import { DbModule, DbService } from '@dua-upd/db';
import { DbUpdateModule, ReadabilityModule } from "@dua-upd/db-update";
import { LoggerModule } from '@dua-upd/logger';
import { SkipAirtableQuestions, UpdateCommand, UpdateQuestions } from './update.command';
import { RepopulateCommand, RepopulateQuestions } from './repopulate.command';
import { RunScriptCommand } from './run-script.command';
import { PopulateCommand } from './populate.command';
import {
  PopulateCollectionPrompt,
  PopulateOverallPrompt,
  PopulatePagesPrompt,
  PopulateCollectionOptionsPrompt,
} from './populate.questions';
import { environment } from '../environments/environment';
import { BlobStorageModule } from '@dua-upd/blob-storage';
import { FeedbackModule } from '@dua-upd/api/feedback';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.DOTENV_CONFIG_PATH || '.env',
      cache: true,
      isGlobal: true,
    }),
    DataIntegrityModule,
    DbUpdateModule.register(environment.production),
    DbModule.forRoot(environment.production, environment.dbHost),
    LoggerModule,
    BlobStorageModule,
    ReadabilityModule,
    FeedbackModule,
  ],
  providers: [
    ConsoleLogger,
    DbService,
    SkipAirtableQuestions,
    UpdateCommand,
    UpdateQuestions,
    RepopulateCommand,
    RepopulateQuestions,
    PopulateCommand,
    PopulateCollectionPrompt,
    PopulateOverallPrompt,
    PopulatePagesPrompt,
    PopulateCollectionOptionsPrompt,
    RunScriptCommand,
  ],
})
export class AppModule {}
