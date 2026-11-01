import { Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { SeedDeleteResultDto, SeedResultDto } from './dto/seed-result.dto.js';
import { SeedService } from './seed.service.js';

/**
 * Endpoints de seed para desarrollo. El servicio responde 404 salvo que
 * `TEST_SEED_ENABLED=true` y `NODE_ENV` no sea `production`.
 */
@Controller('dev')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seed(): Promise<SeedResultDto> {
    return this.seedService.seedDemo();
  }

  @Delete('seed')
  remove(): Promise<SeedDeleteResultDto> {
    return this.seedService.removeDemo();
  }
}
