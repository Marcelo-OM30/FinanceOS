import { Controller, Get, Body, Patch, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Não existe rota para consultar outro usuário: num app financeiro pessoal
// ninguém precisa buscar terceiros, e a rota que existia (GET /users/:id) era
// pública e devolvia a entidade inteira, hash de senha incluso.
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() data: UpdateProfileDto,
  ) {
    return this.usersService.update(user.id, data);
  }

  @Delete('profile')
  async deleteProfile(@CurrentUser() user: User) {
    await this.usersService.delete(user.id);
    return { message: 'Perfil deletado com sucesso' };
  }
}
