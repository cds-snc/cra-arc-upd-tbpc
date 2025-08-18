import { connect, disconnect, model, Mongoose } from 'mongoose';
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
import { ApexOptions } from 'apexcharts';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

class Db {
  private connection: Mongoose | null = null;

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
  readonly customReports = model('CustomReportsRegistry', CustomReportsRegistrySchema);

  async connect(prod = false) {
    const connectionString = `mongodb://${!prod ? 'localhost' : process.env['DB_HOST']}:27017/upd-test`;

    console.log(`Connecting to MongoDB at ${connectionString}`);

    if (!this.connection) {
      this.connection = await connect(connectionString, {
        compressors: ['zstd', 'snappy', 'zlib'],
      });

      return this;
    }

    return this;
  }

  async disconnect() {
    if (this.connection) {
      await disconnect();
      this.connection = null;
    }
  }

  async [Symbol.asyncDispose]() {
    await this.disconnect();
  }

  collection(name: string) {
    return this.connection?.connection.collection(name);
  }
}

export const getDb = (prod = false) => new Db().connect(prod);

async function openHtmlFile(path: string) {
  const spawn = (command: string[]) => Bun.spawn(command);

  switch (process.platform) {
    case 'darwin':
      return spawn(['open chrome', resolve(path)]);
    case 'win32': {
      return new Promise<void>((res) => {
        const proc = spawn(['cmd.exe', '/K', 'start', 'chrome', resolve(path)]);
        proc.unref();
        res();
      });
    }
    default:
      const proc = spawn(['cmd.exe', '/K', 'start', 'chrome', resolve(path)]);
      proc.unref();
    // return spawn(['xdg-open', resolve(path)]);
  }
}

export async function outputChart(filename: string, options: ApexOptions = {}) {
  const output = `
<!DOCTYPE html>
<html>
<head>
</head>
<body>
<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
  <div id="chart" style="width: 98vw; height: 98vh; box-sizing: border-box; border: #0a58ca solid 1px"></div>
  <script>
    var options = {
        series: [{
          name: "Desktops",
          data: [10, 41, 35, 51, 49, 62, 69, 91, 148]
        }],
        chart: {
          height: 500,
          type: 'line',
          zoom: {
            enabled: false
          }
        },
        dataLabels: {
          enabled: false
        },
        stroke: {
          curve: 'smooth'
        },
        title: {
          text: 'Product Trends by Month',
          align: 'left'
        },
        grid: {
          row: {
            colors: ['#f3f3f3', 'transparent'], // takes an array which will be repeated on columns
            opacity: 0.5
          },
        },
        ...(${JSON.stringify(options)})
        };

        var chart = new ApexCharts(document.querySelector("#chart"), options);
        chart.render();

        console.log(options);
  </script>
</body>
</html>
  `;

  await writeFile(`./${filename}.html`, output, 'utf8');

  await openHtmlFile(`./${filename}.html`);
}
