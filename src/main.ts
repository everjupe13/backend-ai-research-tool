import 'dotenv/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { envSchema } from './config/env.schema';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const env = envSchema.parse(process.env);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      // поля не из DTO автоматически срезаются
      whitelist: true,
      // лишние поля возвращают 400 вместо тихого игнора
      forbidNonWhitelisted: true,
      // автоматически приводит типы (строка "1" → число 1, plain object → экземпляр класса DTO)
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformInterceptor(),
  );

  app.enableCors({
    origin: env.NODE_ENV === 'production' ? process.env.APP_URL : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(env.PORT);

  const url = `http://localhost:${env.PORT}`;
  const link = `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`;
  console.log(`\n APP STARTED\n Path: ${process.cwd()}\n URL:  ${link}\n`);
}
void bootstrap();
