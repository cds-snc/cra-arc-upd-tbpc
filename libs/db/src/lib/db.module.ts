// eslint-disable-next-line @typescript-eslint/no-unused-vars
import zstd from '@mongodb-js/zstd'; // need to import this for it to be included in the build output
import { Module } from '@nestjs/common';
import { MongooseModule, type MongooseModuleOptions } from '@nestjs/mongoose';
import {
  AAItemId,
  AAItemIdSchema,
  CallDriver,
  CallDriverSchema,
  CustomReportsRegistry,
  CustomReportsRegistrySchema,
  Feedback,
  FeedbackSchema,
  GcTasks,
  GcTasksSchema,
  Overall,
  OverallSchema,
  Page,
  PageMetrics,
  PageMetricsSchema,
  PageMetricsTS,
  PageMetricsTSSchema,
  PageSchema,
  PagesList,
  PagesListSchema,
  Project,
  ProjectSchema,
  Task,
  TaskSchema,
  UxTest,
  UxTestSchema,
  SearchAssessment,
  SearchAssessmentSchema,
  Url,
  UrlSchema,
  Readability,
  ReadabilitySchema,
  Annotations,
  AnnotationsSchema,
  Reports,
  ReportsSchema,
  CustomReportsMetrics,
  CustomReportsMetricsSchema,
} from './db.schemas';
import {
  GCTasksMappings,
  GCTasksMappingsSchema,
} from './schemas/gc-tasks-mappings.schema';
import { PagesView, PagesViewSchema } from './views/pages-view.schema';
import { TasksView, TasksViewSchema } from './views/tasks-view.schema';

export const models = {
  callDrivers: {
    model: CallDriver as typeof CallDriver,
    schema: CallDriverSchema,
  },
  feedback: { model: Feedback, schema: FeedbackSchema },
  overall: { model: Overall, schema: OverallSchema },
  pageMetrics: { model: PageMetrics, schema: PageMetricsSchema },
  pageMetricsTS: { model: PageMetricsTS, schema: PageMetricsTSSchema },
  pages: { model: Page, schema: PageSchema },
  pagesList: { model: PagesList, schema: PagesListSchema },
  tasks: { model: Task, schema: TaskSchema },
  uxTests: { model: UxTest, schema: UxTestSchema },
  projects: { model: Project, schema: ProjectSchema },
  searchAssessment: { model: SearchAssessment, schema: SearchAssessmentSchema },
  aaItemIds: { model: AAItemId, schema: AAItemIdSchema },
  urls: { model: Url, schema: UrlSchema },
  readability: { model: Readability, schema: ReadabilitySchema },
  annotations: { model: Annotations, schema: AnnotationsSchema },
  reports: { model: Reports, schema: ReportsSchema },
  gcTasks: { model: GcTasks, schema: GcTasksSchema },
  gcTasksMappings: { model: GCTasksMappings, schema: GCTasksMappingsSchema },
  customReportsRegistry: {
    model: CustomReportsRegistry,
    schema: CustomReportsRegistrySchema,
  },
  customReportsMetrics: {
    model: CustomReportsMetrics,
    schema: CustomReportsMetricsSchema,
  },
} as const;

export const views = {
  pagesView: { model: PagesView, schema: PagesViewSchema },
  tasksView: { model: TasksView, schema: TasksViewSchema },
} as const;

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        ...Object.values({ ...models, ...views }).map((collection) => ({
          name: collection.model.name,
          schema: collection.schema,
        })),
      ],
      'defaultConnection',
    ),
  ],
  providers: [],
  exports: [MongooseModule],
})
export class DbModule {
  static forRoot(
    production: boolean,
    prodHost = 'mongodb',
    dbName = 'upd-test',
  ) {
    const connectionString = `mongodb://${production ? prodHost : '127.0.0.1'}:27017/`;

    console.log(connectionString);

    // Settings for DocumentDB
    const config: MongooseModuleOptions =
      production && (process.env.DOCDB_USERNAME || process.env.MONGO_USERNAME)
        ? {
            ssl: true,
            tlsCAFile:
              process.env.DB_TLS_CA_FILE || process.env.MONGO_TLS_CA_FILE,
            auth: {
              username:
                process.env.DOCDB_USERNAME || process.env.MONGO_USERNAME,
              password:
                process.env.DOCDB_PASSWORD || process.env.MONGO_PASSWORD,
            },
            replicaSet: 'rs0',
            readPreference: 'secondaryPreferred',
            retryWrites: false,
          }
        : {};

    return MongooseModule.forRoot(connectionString, {
      connectionName: 'defaultConnection',
      dbName,
      compressors: ['zstd', 'snappy', 'zlib'],
      retryWrites: true,
      ...config,
    });
  }
}
