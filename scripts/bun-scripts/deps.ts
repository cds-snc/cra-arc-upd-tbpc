import {
  connect,
  disconnect,
  model,
  Mongoose,
  type ConnectOptions,
} from 'mongoose';
import {
  PageMetricsSchema,
  PageSchema,
  TaskSchema,
  UxTestSchema,
  ProjectSchema,
  OverallSchema,
  FeedbackSchema,
  CallDriverSchema,
  UrlSchema,
  GCTasksMappingsSchema,
  CustomReportsRegistrySchema,
} from '@dua-upd/db';
import type { ApexAxisChartSeries, ApexOptions } from 'apexcharts';
import { DuckDbExtensionsManager } from '@dua-upd/duckdb';
import { drizzle, type DuckDBDatabase } from '@duckdbfan/drizzle-duckdb';
import { freemem, availableParallelism } from 'node:os';
import { DuckDBInstance } from '@duckdb/node-api';

class Db {
  private _connection: Mongoose | null = null;

  readonly pages = model('Page', PageSchema);
  readonly pageMetrics = model('PageMetrics', PageMetricsSchema);
  readonly tasks = model('Task', TaskSchema);
  readonly uxTests = model('UxTest', UxTestSchema);
  readonly projects = model('Project', ProjectSchema);
  readonly overall = model('Overall', OverallSchema);
  readonly feedback = model('Feedback', FeedbackSchema);
  readonly calldrivers = model('CallDriver', CallDriverSchema);
  readonly urls = model('Url', UrlSchema);
  readonly gcTasksMappings = model('GCTasksMappings', GCTasksMappingsSchema);
  readonly customReports = model(
    'CustomReportsRegistry',
    CustomReportsRegistrySchema,
  );

  get connection() {
    return this._connection;
  }

  async connect(prod = false) {
    const connectionString = `mongodb://${!prod ? 'localhost' : process.env['DB_HOST']}:27017/upd-test`;

    console.log(`Connecting to MongoDB at ${connectionString}`);

    if (!this._connection) {
      const config: ConnectOptions =
        prod && (process.env.DOCDB_USERNAME || process.env.MONGO_USERNAME)
          ? {
              authMechanism: 'SCRAM-SHA-1',
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

      this._connection = await connect(connectionString, {
        dbName: 'upd-test',
        compressors: ['zstd', 'snappy', 'zlib'],
        ...config,
      });

      return this;
    }

    return this;
  }

  async disconnect() {
    if (this._connection) {
      await disconnect();
      this._connection = null;
    }
  }

  async [Symbol.asyncDispose]() {
    await this.disconnect();
  }

  collection(name: string) {
    return this._connection?.connection.collection(name);
  }
}

export const getDb = (prod = false) => new Db().connect(prod);

export type LineChartTitles = {
  chart?: string;
  xAxis?: string;
  yAxis?: string;
};

export type LineChartOutput = 'file' | 'server';

const chartFile = 'line-chart.html';

const jsonForHtml = (value: unknown) =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');

const htmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

async function renderLineChart(
  series: ApexAxisChartSeries,
  titles: LineChartTitles,
) {
  if (series.length === 0) {
    throw new Error('Line chart data must include at least one series.');
  }

  const apexCharts = await Bun.file(
    Bun.fileURLToPath(import.meta.resolve('apexcharts/dist/apexcharts.min.js')),
  ).text();

  const options: ApexOptions = {
    chart: {
      type: 'line',
      height: '100%',
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series,
    xaxis: {
      title: { text: titles.xAxis },
    },
    yaxis: {
      title: { text: titles.yAxis },
    },
    title: {
      text: titles.chart,
      align: 'left',
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    grid: { borderColor: '#e5e7eb' },
    theme: { mode: 'light' },
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${htmlEscape(titles.chart ?? 'Line chart')}</title>
  <style>body { margin: 0; } #chart { height: 100vh; }</style>
</head>
<body>
  <div id="chart"></div>
  <script>
${apexCharts}
  </script>
  <script>
    const options = ${jsonForHtml(options)};
    new ApexCharts(document.querySelector('#chart'), options).render();
  </script>
</body>
</html>
  `;
}

/**
 * Creates a line chart from named series. Select `'server'` to keep a local
 * chart server running; otherwise, it writes `line-chart.html` to the current directory.
 */
export async function createLineChart(
  data: ApexAxisChartSeries,
  titles: LineChartTitles = {},
  output: LineChartOutput = 'file',
) {
  const html = await renderLineChart(data, titles);

  if (output === 'file') {
    await Bun.write(chartFile, html);
    return { file: chartFile };
  }

  const server = Bun.serve({
    hostname: 'localhost',
    port: 0,
    fetch: () =>
      new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
  });

  console.log(`Line chart available at ${server.url}`);
  return server;
}

/**
 * DuckDB helper functions.
 */

async function setupExtensions(db: DuckDBDatabase) {
  const extensionsManager = new DuckDbExtensionsManager(db);
  await extensionsManager.installExtension('httpfs');
  await extensionsManager.installExtension('aws');
}

async function setupAuth(db: DuckDBDatabase) {
  await db.execute(`
        CREATE OR REPLACE SECRET s3 (
          TYPE s3,
          PROVIDER credential_chain,
          REGION 'ca-central-1',
          REFRESH auto
        ); 
      `);
}

async function setResourceLimits(
  db: DuckDBDatabase,
  config: { memoryLimitMb?: number; numThreads?: number },
) {
  const systemMemoryMB = freemem() / (1024 * 1024);
  const memoryLimit = config.memoryLimitMb ?? Math.floor(systemMemoryMB * 0.7); // default to 70% of available system memory

  console.log(`Setting DuckDB memory limit to ${memoryLimit} MB`);
  await db.execute(`SET memory_limit = '${memoryLimit}MB';`);

  const numThreads = config.numThreads ?? (availableParallelism() - 1 || 1);
  console.log(`Setting DuckDB threads to ${numThreads}`);
  await db.execute(`SET threads = ${numThreads};`);
}

export async function duckDbClient(
  config: {
    connectionString?: string;
    logger?: boolean;
    memoryLimitMb?: number;
    numThreads?: number;
  } = {},
) {
  const instance =
    config.connectionString === ':memory:' || !config.connectionString
      ? await DuckDBInstance.create(config.connectionString ?? ':memory:')
      : await DuckDBInstance.fromCache(config.connectionString);
  const client = await instance.connect();
  const duckDb = drizzle(client, { logger: config.logger ?? true });

  await setupExtensions(duckDb);
  await setupAuth(duckDb);
  await setResourceLimits(duckDb, {
    memoryLimitMb: config.memoryLimitMb,
    numThreads: config.numThreads,
  });

  type AsyncDisposableDuckDb = typeof duckDb & {
    [Symbol.asyncDispose]: () => Promise<void>;
  };

  (duckDb as AsyncDisposableDuckDb)[Symbol.asyncDispose] = async () => {
    await duckDb.close();
  };

  return duckDb as AsyncDisposableDuckDb;
}
