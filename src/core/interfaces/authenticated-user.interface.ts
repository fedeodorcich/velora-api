/**
 * Representación pública del usuario autenticado, adjunta a `request.user`.
 * Nunca incluye el hash de la contraseña.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}
