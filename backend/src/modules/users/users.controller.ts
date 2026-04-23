import { Controller, Get, Param, Body, Patch, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: User, @Body() data: Partial<User>) {
    return this.usersService.update(user.id, data);
  }

  @Delete('profile')
  @UseGuards(JwtAuthGuard)
  async deleteProfile(@CurrentUser() user: User) {
    await this.usersService.delete(user.id);
    return { message: 'Perfil deletado com sucesso' };
  }
}
