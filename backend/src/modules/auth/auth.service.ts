import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<any> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new Error('Email já cadastrado');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      nome: dto.nome,
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new Error('Email ou senha inválidos');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new Error('Email ou senha inválidos');
    }

    // Update last login
    await this.usersService.update(user.id, { ultimoLogin: new Date() });

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<any> {
    const secret = this.refreshSecret();
    let payload: { id: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Sessão expirada');
    }

    const user = await this.usersService.findById(payload.id);
    if (!user) {
      throw new UnauthorizedException('Sessão expirada');
    }

    // Devolve um refresh token novo junto: a sessão só expira depois de 7 dias
    // sem uso, não 7 dias depois do login.
    return this.generateTokens(user);
  }

  async validateUser(id: string): Promise<User | null> {
    return this.usersService.findById(id);
  }

  private generateTokens(user: User) {
    const payload = { id: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: this.refreshSecret(),
    });

    // O usuário vai aninhado em `user`: é o formato que o frontend consome
    // (`const { user, accessToken } = res.data`) e mantém os dados da pessoa
    // separados das credenciais.
    return {
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
      },
      accessToken,
      refreshToken,
    };
  }

  // Sem este segredo o JwtService cai no JWT_SECRET sem avisar, e aí access e
  // refresh token passam a ser intercambiáveis: um refresh vira acesso de 7 dias.
  private refreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET não configurado');
    }
    return secret;
  }
}
