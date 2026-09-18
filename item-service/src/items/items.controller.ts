import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller()
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: 200, description: 'Category list' })
  listCategories() {
    return this.itemsService.listCategories();
  }

  @Post('categories')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a category (admin only)' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 409, description: 'Category already exists' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.itemsService.createCategory(dto);
  }

  @Patch('categories/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rename a category (admin only)' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.itemsService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category (admin only)' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.itemsService.deleteCategory(id);
  }

  @Get('items')
  @ApiOperation({ summary: 'List menu items, optionally by category' })
  @ApiQuery({ name: 'category_id', required: false, description: 'Filter by category UUID' })
  @ApiResponse({ status: 200, description: 'Item list' })
  listItems(@Query('category_id') categoryId?: string) {
    return this.itemsService.listItems(categoryId);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get one menu item' })
  @ApiResponse({ status: 200, description: 'The item' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  getItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.itemsService.getItem(id);
  }

  @Post('items')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a menu item (admin only)' })
  @ApiResponse({ status: 201, description: 'Item created' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  createItem(@Body() dto: CreateItemDto) {
    return this.itemsService.createItem(dto);
  }

  @Patch('items/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a menu item (admin only)' })
  @ApiResponse({ status: 200, description: 'Item updated' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemsService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a menu item (admin only)' })
  @ApiResponse({ status: 200, description: 'Item deleted' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  deleteItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.itemsService.deleteItem(id);
  }
}
