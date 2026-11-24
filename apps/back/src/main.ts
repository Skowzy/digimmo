import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { configureApp } from './configure-app';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app, env);
  await app.listen(env.PORT);
}
void bootstrap();
