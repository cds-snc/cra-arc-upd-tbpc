import { ConsoleLogger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  DataIntegrityService,
} from '@dua-upd/data-integrity';
import { DbUpdateModule } from '@dua-upd/db-update';
import { DbModule } from '@dua-upd/db';
import { environment } from '../environments/environment';
import { UpdateTaskService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.DOTENV_CONFIG_PATH || '.env',
      cache: true,
      isGlobal: true,
    }),
    DbUpdateModule.register(environment.production),
    DbModule.forRoot(environment.production, environment.dbHost),
  ],
  providers: [UpdateTaskService, DataIntegrityService, ConsoleLogger],
})
export class AppModule {}
