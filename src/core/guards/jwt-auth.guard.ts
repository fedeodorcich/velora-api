import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que exige un token JWT válido (estrategia `jwt`).
 * Se aplica a toda ruta privada.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
