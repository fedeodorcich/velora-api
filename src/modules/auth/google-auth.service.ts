import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { env } from '../../core/config/env.js';
import { hashPassword } from '../../core/security/password.js';
import { User } from '../users/entities/user.entity.js';
import type { GoogleLoginDto } from './dto/google-login.dto.js';

@Injectable()
export class GoogleAuthService {
  private readonly client = new OAuth2Client();
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async authenticate(dto: GoogleLoginDto): Promise<User> {
    if (!env.googleClientId)
      throw new ServiceUnavailableException(
        'El acceso con Google todavía no está habilitado.',
      );
    let identity;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: dto.credential,
        audience: env.googleClientId,
      });
      identity = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        'No pudimos verificar tu cuenta de Google. Volvé a intentarlo.',
      );
    }
    if (
      !identity?.sub ||
      !identity.email ||
      identity.email_verified !== true ||
      identity.nonce !== dto.nonce
    )
      throw new UnauthorizedException(
        'La cuenta de Google no es válida o su correo no está verificado.',
      );
    const linked = await this.users.findOne({
      where: { googleSub: identity.sub },
    });
    if (linked) return linked;
    const email = identity.email.toLowerCase().trim();
    const existing = await this.users.findOne({
      where: { email },
      select: { id: true, email: true, name: true, googleSub: true },
    });
    if (existing) {
      // Solo Gmail y Workspace prueban propiedad actual del correo (no terceros).
      if (existing.googleSub || !(email.endsWith('@gmail.com') || identity.hd))
        throw new ConflictException(
          'Ya existe una cuenta con este correo. Ingresá con tu contraseña para conservar el acceso.',
        );
      const result = await this.users.update(
        { id: existing.id, googleSub: IsNull() },
        { googleSub: identity.sub },
      );
      if (!result.affected)
        throw new ConflictException(
          'La cuenta cambió. Volvé a iniciar sesión.',
        );
      return existing;
    }
    const user = this.users.create({
      email,
      name: (identity.name?.trim() || email.split('@')[0]).slice(0, 120),
      googleSub: identity.sub,
      passwordHash: await hashPassword(randomBytes(48).toString('base64url')),
    });
    try {
      return await this.users.save(user);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      )
        throw new ConflictException(
          'La cuenta ya fue creada. Volvé a iniciar sesión.',
        );
      throw error;
    }
  }
}
