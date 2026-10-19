import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { correlationId } from './correlation-id.middleware.js';
import { ErrorFilter } from './error.filter.js';

export interface HttpServiceOptions {
  /** Set to false when the service forwards raw request bodies (the gateway's proxy). */
  bodyParser?: boolean;
}

/** Creates a Nest HTTP app with the shared conventions: correlation IDs, validation, error shape, and Swagger at /docs. */
export async function createHttpService(
  module: Parameters<typeof NestFactory.create>[0],
  service: string,
  options: HttpServiceOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(module, {
    bodyParser: options.bodyParser ?? true,
  });
  app.use(correlationId);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle(`CampusKit ${service}`)
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
  return app;
}

export function envPort(name: string, fallback: number): number {
  return Number(process.env[name] ?? fallback);
}

export async function listen(
  app: INestApplication,
  service: string,
  port: number,
): Promise<void> {
  await app.listen(port);
  Logger.log(
    `${service} listening on http://localhost:${port} (docs at /docs)`,
    'Bootstrap',
  );
}
