import { Controller, DynamicModule, Get, Module } from '@nestjs/common';

/** Adds GET /health to a service. Compose and the gateway use it to see that the service is up. */
@Module({})
export class HealthModule {
  static register(service: string): DynamicModule {
    @Controller('health')
    class HealthController {
      @Get()
      check() {
        return { status: 'ok', service };
      }
    }
    return { module: HealthModule, controllers: [HealthController] };
  }
}
