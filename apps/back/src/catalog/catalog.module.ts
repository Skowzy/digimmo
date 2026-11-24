import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { FurnitureItem } from './furniture-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FurnitureItem])],
  controllers: [CatalogController, AdminCatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
