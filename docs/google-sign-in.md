# SPEC-013 · Acceso con Google

Fecha: 26/11/2026.

Botón oficial de Google Identity Services, compartido entre ingreso y registro. Se carga únicamente en esas páginas cuando GET /auth/google/config devuelve un Client ID. El popup devuelve un ID token, enviado por JSON a POST /auth/google junto al nonce generado por el navegador. No se usan tokens en URLs ni se solicitan permisos de Gmail, contactos o archivos.

El backend verifica firma, audiencia, emisor y expiración mediante google-auth-library, y exige sub, email verificado y nonce coincidente. La clave GOOGLE_CLIENT_ID es pública; no se necesita Client Secret para este flujo. Token Google no se persiste: se emite la misma sesión JWT interna del acceso por contraseña.

Migración AddGoogleIdentity agrega google_sub único y opcional. Cuentas vinculadas se identifican por sub y conservan su correo y datos internos. Coincidencia de correo existente solo se vincula automáticamente si Google es autoridad actual (Gmail o Workspace); otros proveedores requieren ingreso por contraseña y no se fusionan automáticamente. Las cuentas nuevas reciben un hash scrypt de contraseña aleatoria desconocida; cambiar contraseña con la actual no está disponible para esas cuentas. No se ofrece recuperación ni contraseña local nueva en este alcance. Conflictos concurrentes responden 409.

## Configuración
Crear cliente OAuth de tipo Aplicación web en Google Auth Platform. Nombre Bakrivo, soporte veloracrm.support@gmail.com. Orígenes JavaScript autorizados: https://velora-web-0bwz.onrender.com y http://localhost:4200 si se usa desarrollo. No agregar rutas. No necesita URI de redirección porque usa popup con callback JavaScript. Configurar consentimiento externo y datos básicos de identidad (openid, email, profile); publicar según los requisitos del panel. Guardar Client ID *.apps.googleusercontent.com en GOOGLE_CLIENT_ID en backend/.env y Render. Nunca guardar Client Secret en frontend. Mantener acceso oculto mientras falte configuración.

## Validación
Pruebas de token inválido, correo no verificado, nonce incorrecto, identidad por sub, alta nueva, asociación Gmail, rechazo de asociación insegura y conflictos. Falta prueba real con cuenta Google hasta configurar un Client ID válido.

Fuentes: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token y https://developers.google.com/identity/gsi/web/reference/js-reference

## Resultado de verificación
95 pruebas unitarias backend aprobadas. Diez pruebas de integración aprobadas sobre PostgreSQL aislado velora_webhook_e2e, incluidas tres del acceso Google con proveedor simulado y siete regresiones del acceso por contraseña. Migración aplicada en esa base; altas, asociación conservando id, sesión JWT y contraseña existente comprobadas. Build backend, lint y build de desarrollo frontend aprobados. No se probó un inicio real con Google ni se desplegó: falta Client ID. La consola Google no pudo abrirse por fallo de la herramienta de navegador.
