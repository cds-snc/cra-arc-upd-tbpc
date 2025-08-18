import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { UpdateTaskService } from './app/app.service';

const app = await NestFactory.create(AppModule);
const globalPrefix = 'db-update-task';
app.setGlobalPrefix(globalPrefix);

Logger.log(
  `🚀 DB Update task starting`,
);

await app.select(AppModule).get(UpdateTaskService).updateDatabase();

await app.close();