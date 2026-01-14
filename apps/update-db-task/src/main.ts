import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { UpdateTaskService } from './app/app.service';

const app = await NestFactory.createApplicationContext(AppModule);

Logger.log(
  `🚀 DB Update task starting`,
);

await app.select(AppModule).get(UpdateTaskService).updateDatabase();

await app.enableShutdownHooks().close();