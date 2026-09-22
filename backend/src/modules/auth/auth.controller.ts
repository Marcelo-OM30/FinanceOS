import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    try {
      return await this.authService.register(dto);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      return await this.authService.login(dto);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  // Erro aqui é 401, não 400: é o sinal para o frontend mandar a pessoa ao login.
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}
