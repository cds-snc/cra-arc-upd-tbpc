import { Controller, Get } from '@nestjs/common';

@Controller('_healthcheck')
export class HealthCheckController {
  @Get()
  healthCheck() {
    return 'OK';
  }
}
