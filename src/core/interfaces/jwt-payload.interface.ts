/**
 * Contenido firmado dentro del token JWT.
 */
export interface JwtPayload {
  /** Identificador del usuario autenticado. */
  sub: string;
  /** Correo del usuario autenticado. */
  email: string;
}
