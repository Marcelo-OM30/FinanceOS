import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { AddProgressDto } from './dto/add-progress.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.goalsService.findAll(user.id, user.timezone);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.goalsService.findOne(id, user.id, user.timezone);
  }

  @Post()
  create(
    @Body() dto: CreateGoalDto,
    @CurrentUser() user: User,
  ) {
    return this.goalsService.create(user.id, dto, user.timezone);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
    @CurrentUser() user: User,
  ) {
    return this.goalsService.update(id, user.id, dto, user.timezone);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.goalsService.remove(id, user.id);
  }

  // ─── Progresso ─────────────────────────────────────────────────────────────

  @Get(':id/progress')
  findProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.goalsService.findProgress(id, user.id);
  }

  @Post(':id/progress')
  addProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProgressDto,
    @CurrentUser() user: User,
  ) {
    return this.goalsService.addProgress(id, user.id, dto, user.timezone);
  }
}
