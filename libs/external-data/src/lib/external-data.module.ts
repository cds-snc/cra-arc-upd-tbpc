import { BlobStorageModule } from '@dua-upd/blob-storage';
import { Module, ConsoleLogger } from '@nestjs/common';
import { AdobeAnalyticsService } from './adobe-analytics/adobe-analytics.service';
import { BlobProxyService } from './blob-proxy.service';
import { GoogleSearchConsoleService } from './google-search-console/google-search-console.service';
import { AdobeAnalyticsClient } from './adobe-analytics';
import { SearchAnalyticsClient } from './google-search-console';
import { PageSpeedInsightsService } from './pagespeed-insights/pagespeed-insights.service';
import { PageSpeedInsightsClient } from './pagespeed-insights/pagespeed-insights.client';
import { ConfigService } from '@nestjs/config';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { OpenRouterService } from './openrouter/openrouter.service';

@Module({
  imports: [BlobStorageModule],
  providers: [
    AdobeAnalyticsService,
    BlobProxyService,
    GoogleSearchConsoleService,
    PageSpeedInsightsService,
    OpenRouterService,
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
      provide: PageSpeedInsightsClient.name,
      useFactory: () => new PageSpeedInsightsClient(),
      inject: [ConfigService],
    },
    {
      provide: OpenRouterClient.name,
      useFactory: () => new OpenRouterClient(),
      inject: [ConfigService],
    },
  ],
  exports: [
    AdobeAnalyticsService,
    AdobeAnalyticsClient.name,
    BlobProxyService,
    GoogleSearchConsoleService,
    SearchAnalyticsClient.name,
    PageSpeedInsightsService,
    PageSpeedInsightsClient.name,
    OpenRouterService,
    OpenRouterClient.name,
  ],
})
export class ExternalDataModule {}
