import { Global, Module } from '@nestjs/common';
import { getAACredsPool } from '@dua-upd/node-utils';
import { AdobeAnalyticsClient } from './adobe-analytics.client';

export const AA_CLIENT_TOKEN = 'AA_CLIENT';

@Global()
@Module({})
export class AdobeAnalyticsModule {
  static register(production = false) {
    return {
      module: AdobeAnalyticsModule,
      providers: [
        {
          provide: AA_CLIENT_TOKEN,
          useFactory: async () => {
            const client = production
              ? new AdobeAnalyticsClient(await getAACredsPool())
              : new AdobeAnalyticsClient();

            await client.init();

            return client;
          },
        },
      ],
      exports: [AA_CLIENT_TOKEN],
    };
  }
}
