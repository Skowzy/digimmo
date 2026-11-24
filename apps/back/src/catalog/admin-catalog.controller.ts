import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  type FurnitureItemDto,
  type FurnitureItemPatchDto,
  furnitureItemPatchSchema,
  furnitureItemSchema,
} from './catalog.schemas';
import { CatalogService } from './catalog.service';

const uuid = () => new ParseUUIDPipe({ exceptionFactory: () => invalidId() });
const invalidId = () =>
  new BadRequestException({ message: 'Identifiant invalide.' });

@Roles('admin')
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(furnitureItemSchema)) dto: FurnitureItemDto,
  ) {
    return this.catalog.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(furnitureItemPatchSchema))
    dto: FurnitureItemPatchDto,
  ) {
    return this.catalog.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', uuid()) id: string): Promise<void> {
    await this.catalog.remove(id);
  }
}
