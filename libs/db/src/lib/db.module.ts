// eslint-disable-next-line @typescript-eslint/no-unused-vars
import zstd from '@mongodb-js/zstd'; // need to import this for it to be included in the build output
import { Module } from '@nestjs/common';
import { MongooseModule, type MongooseModuleOptions } from '@nestjs/mongoose';
import { models, views } from './db.models';
import { DbService } from './db.service';

const MongooseFeatureModule = MongooseModule.forFeature(
  [
    ...Object.values({ ...models, ...views }).map((collection) => ({
      name: collection.model.name,
      schema: collection.schema,
    })),
  ],
  'defaultConnection',
);

@Module({
  imports: [MongooseFeatureModule],
  providers: [DbService],
  exports: [DbService, MongooseFeatureModule],
})
export class DbModule {
  static forRoot(
    production: boolean,
    prodHost = process.env.DB_HOST || 'mongodb',
    dbName = 'upd-test',
  ) {
    const USE_PROD_DB_HOST = process.env.USE_PROD_DB_HOST === 'true';

    const connectionString = `mongodb://${production || USE_PROD_DB_HOST ? prodHost : '127.0.0.1'}:27017/`;

    console.log(connectionString);

    // Settings for DocumentDB
    const config: MongooseModuleOptions =
      (production || USE_PROD_DB_HOST) &&
      (process.env.DOCDB_USERNAME || process.env.MONGO_USERNAME)
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
      compressors: ['zstd', 'snappy'],
      retryWrites: true,
      ...config,
    });
  }
}
