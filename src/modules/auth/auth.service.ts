import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../../core/security/password.js';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-user.interface.js';
import type { JwtPayload } from '../../core/interfaces/jwt-payload.interface.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta registrada con ese correo.');
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Las credenciales no son válidas.');
    }

    const isPasswordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Las credenciales no son válidas.');
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toAuthenticatedUser(user),
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return { id: user.id, email: user.email, name: user.name };
  }
}
