import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService.refresh', () => {
  const user = { id: 'u1', email: 'a@b.com', nome: 'Ana' };
  const jwtService = new JwtService({ secret: 'access-secret' });
  let usersService: { findById: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    usersService = { findById: jest.fn().mockResolvedValue(user) };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService,
    );
  });

  const refreshTokenFor = (id: string, expiresIn: '7d' | '-1s' = '7d') =>
    jwtService.sign(
      { id, email: user.email },
      { secret: 'refresh-secret', expiresIn },
    );

  it('devolve um par novo no mesmo formato do login', async () => {
    const result = await service.refresh(refreshTokenFor('u1'));

    expect(result.user).toEqual(user);
    expect(jwtService.verify(result.accessToken).id).toBe('u1');
    expect(
      jwtService.verify(result.refreshToken, { secret: 'refresh-secret' }).id,
    ).toBe('u1');
  });

  it('recusa um access token usado como refresh token', async () => {
    const accessToken = jwtService.sign({ id: 'u1', email: user.email });

    await expect(service.refresh(accessToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('recusa refresh token expirado', async () => {
    await expect(service.refresh(refreshTokenFor('u1', '-1s'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('recusa token de usuário que não existe mais', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(service.refresh(refreshTokenFor('u1'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('não cai no JWT_SECRET quando JWT_REFRESH_SECRET falta', async () => {
    delete process.env.JWT_REFRESH_SECRET;
    const accessToken = jwtService.sign({ id: 'u1', email: user.email });

    await expect(service.refresh(accessToken)).rejects.toThrow(
      'JWT_REFRESH_SECRET não configurado',
    );
  });
});
