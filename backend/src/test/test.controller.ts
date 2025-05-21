import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TestService } from './test.service';
import { CreateTestDto } from './dto/create-test.dto';
import { Test } from './test.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user-account/user-account.entity';

@Controller('tests')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() createTestDto: CreateTestDto): Promise<Test> {
    return this.testService.create(createTestDto);
  }

  @Get()
  async findAll(@Query('model') model?: string): Promise<Test[]> {
    // If a model query param is provided, find compatible tests, otherwise find all.
    // The findCompatibleTests method in service already handles if modelName is undefined.
    return this.testService.findCompatibleTests(model);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Test> {
    return this.testService.findById(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.testService.remove(id);
  }
}
