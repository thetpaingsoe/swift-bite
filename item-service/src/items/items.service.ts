import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadGatewayException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { categories, menuItems } from '../db/schema';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(private readonly dbService: DbService) {}

  async listCategories() {
    return this.dbService.db.select().from(categories);
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.dbService.db
      .select()
      .from(categories)
      .where(eq(categories.name, dto.name))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Category already exists');
    }

    let created;
    try {
      [created] = await this.dbService.db
        .insert(categories)
        .values({ name: dto.name })
        .returning();
    } catch (error) {
      this.logger.error('Failed to create category', error as Error);
      throw new BadGatewayException('Could not create the category');
    }

    return created;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const [existing] = await this.dbService.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const [updated] = await this.dbService.db
      .update(categories)
      .set({ name: dto.name })
      .where(eq(categories.id, id))
      .returning();

    return updated;
  }

  async deleteCategory(id: string) {
    const [existing] = await this.dbService.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    await this.dbService.db.delete(categories).where(eq(categories.id, id));
    return { message: 'Category deleted' };
  }

  async listItems(categoryId?: string) {
    if (categoryId) {
      return this.dbService.db
        .select()
        .from(menuItems)
        .where(eq(menuItems.categoryId, categoryId));
    }
    return this.dbService.db.select().from(menuItems);
  }

  async getItem(id: string) {
    const [item] = await this.dbService.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async createItem(dto: CreateItemDto) {
    const [category] = await this.dbService.db
      .select()
      .from(categories)
      .where(eq(categories.id, dto.categoryId))
      .limit(1);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    let created;
    try {
      [created] = await this.dbService.db
        .insert(menuItems)
        .values({
          name: dto.name,
          description: dto.description,
          price: String(dto.price),
          categoryId: dto.categoryId,
          imageUrl: dto.imageUrl,
          available: dto.available ?? true,
        })
        .returning();
    } catch (error) {
      this.logger.error('Failed to create menu item', error as Error);
      throw new BadGatewayException('Could not create the menu item');
    }

    return created;
  }

  async updateItem(id: string, dto: UpdateItemDto) {
    const [existing] = await this.dbService.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Item not found');
    }

    if (dto.categoryId) {
      const [category] = await this.dbService.db
        .select()
        .from(categories)
        .where(eq(categories.id, dto.categoryId))
        .limit(1);

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const [updated] = await this.dbService.db
      .update(menuItems)
      .set({
        ...dto,
        price: dto.price === undefined ? undefined : String(dto.price),
      })
      .where(eq(menuItems.id, id))
      .returning();

    return updated;
  }

  async deleteItem(id: string) {
    const [existing] = await this.dbService.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Item not found');
    }

    await this.dbService.db.delete(menuItems).where(eq(menuItems.id, id));
    return { message: 'Item deleted' };
  }
}
