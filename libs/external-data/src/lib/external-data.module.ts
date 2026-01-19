import { BlobStorageModule } from '@dua-upd/blob-storage';
import { Module, ConsoleLogger } from '@nestjs/common';
import { AdobeAnalyticsService } from './adobe-analytics/adobe-analytics.service';
import { BlobProxyService } from './blob-proxy.service';
import { GoogleSearchConsoleService } from './google-search-console/google-search-console.service';
import { AdobeAnalyticsClient } from './adobe-analytics';
import { SearchAnalyticsClient } from './google-search-console';
import { AxeCoreService } from './axe-core/axe-core.service';
import { AxeCoreClient } from './axe-core/axe-core.client';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [BlobStorageModule],
  providers: [
    AdobeAnalyticsService,
    BlobProxyService,
    GoogleSearchConsoleService,
    AxeCoreService,
    ConsoleLogger,
    {
      provide: AdobeAnalyticsClient.name,
      useValue: new AdobeAnalyticsClient(),
    },
    {
      provide: SearchAnalyticsClient.name,
      useFactory: () => new SearchAnalyticsClient(),
      inject: [ConfigService],
    },
    {
      provide: AxeCoreClient.name,
      useFactory: () => new AxeCoreClient(),
      inject: [ConfigService],
    },
  ],
  exports: [
    AdobeAnalyticsService,
    AdobeAnalyticsClient.name,
    BlobProxyService,
    GoogleSearchConsoleService,
    SearchAnalyticsClient.name,
    AxeCoreService,
    AxeCoreClient.name,
  ],
})
export class ExternalDataModule {}
