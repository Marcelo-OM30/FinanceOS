import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    // TODO: Implementar refresh token logic
    return { message: 'Refresh endpoint not implemented yet' };
  }
}
