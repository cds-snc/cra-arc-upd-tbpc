import { Controller, Get, Query } from '@nestjs/common';
import { HashesService } from './hashes.service';

@Controller('hashes')
export class HashesController {
  constructor(private hashesService: HashesService) {}

  @Get('get-hashes')
  async hashes(@Query('id') id: string) {
    return await this.hashesService.getHashes(id);
  }
}
