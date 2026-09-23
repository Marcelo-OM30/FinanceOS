import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RecurringService } from './recurring.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('recurring-rules')
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.recurringService.findAll(user.id, user.timezone);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.recurringService.findOne(id, user.id, user.timezone);
  }

  @Post()
  create(@Body() dto: CreateRecurringDto, @CurrentUser() user: User) {
    return this.recurringService.create(user.id, dto, user.timezone);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringDto,
    @CurrentUser() user: User,
  ) {
    return this.recurringService.update(id, user.id, dto, user.timezone);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.recurringService.remove(id, user.id, user.timezone);
  }
}
