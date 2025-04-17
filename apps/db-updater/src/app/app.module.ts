import { ConsoleLogger, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import {
  DataIntegrityModule,
  DataIntegrityService,
} from '@dua-upd/data-integrity';
import { DbUpdateModule } from '@dua-upd/db-update';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '@dua-upd/db';
import { environment } from '../environments/environment';
import { UpdateService } from '../update-service/update.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.DOTENV_CONFIG_PATH || '.env',
      cache: true,
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DataIntegrityModule,
    DbUpdateModule.register(environment.production),
    DbModule.forRoot(environment.production, environment.dbHost),
  ],
  providers: [UpdateService, DataIntegrityService, ConsoleLogger],
})
export class AppModule {}
