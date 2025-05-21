import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { CreateAttemptDto } from './dto/create-attempt.dto';
import { Attempt } from './attempt.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';

@Controller('attempts')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Request() req: { user: JwtPayload },
    @Body() createAttemptDto: CreateAttemptDto,
  ): Promise<Attempt> {
    return this.attemptService.create(createAttemptDto, req.user.username);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req: { user: JwtPayload }): Promise<Attempt[]> {
    return this.attemptService.findAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: JwtPayload },
  ): Promise<Attempt> {
    return this.attemptService.findOne(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: JwtPayload },
  ): Promise<void> {
    return this.attemptService.remove(id, req.user);
  }

  // We will add other endpoints like GET /attempts, GET /attempts/:id later
}
