import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { UpdateTaskService } from './app/app.service';
import { wait, minutes } from '@dua-upd/utils-common';

class NoColourLogger extends ConsoleLogger {
  colorize(message: string, logLevel: string): string {
    return message;
  }

  formatContext(context: string): string {
    return `[${context}] `;
  }
}

async function bootstrap() {
  const logger = new NoColourLogger('update-db-task');
  const app = await NestFactory.createApplicationContext(AppModule, { logger });

  logger.log(`🚀 DB Update task starting`);

  await app.select(AppModule).get(UpdateTaskService).updateDatabase();

  app.enableShutdownHooks();

  return Promise.race([
    wait(minutes(5)), // end the process after 5 minutes
    app.close(),
  ]);
}

bootstrap().then(() => {
  process.exit(0);
});
