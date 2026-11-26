# SPEC-014 · Publicidad y aportantes sin anuncios

26/11/2026. Decisión del titular: sin anuncios para siempre al acreditar un aporte. Sustituye las afirmaciones de SPEC-011 que negaban cualquier beneficio. Se comunica como aporte con beneficio sin anuncios; no se afirma carácter fiscal de donación sin contraprestación. Todas las funciones de CRM siguen gratis.

## Publicidad
Primera modalidad: patrocinio directo configurable mediante ADS_ENABLED, ADS_SPONSOR_NAME, ADS_SPONSOR_DESCRIPTION y ADS_SPONSOR_URL HTTPS. Banner reutilizable rotulado Publicidad, solo en panel y listados; excluye formularios, documentos imprimibles, legales e ingreso. No hay scripts ni cookies publicitarias, intercambio de datos comerciales ni anuncio ficticio. Falta contratar un anunciante para generar ingresos. No es una integración AdSense ni programática. Bandera deshabilitada por defecto.

## Beneficio permanente
Migración agrega users.ad_free_since y ad_free_payment_ref (único). GET /community/advertising exige JWT, consulta exclusivamente la cuenta autenticada, devuelve beneficio y solo envía el patrocinador cuando corresponde. Sin fecha de expiración ni renovación. Si falla la consulta, el frontend no muestra anuncios.

El link de monto libre actual no identifica automáticamente al usuario de Bakrivo. Se solicita número de operación y correo de cuenta a soporte. Operador verifica pago aprobado, importe positivo, receptor real y titularidad del comprobante en Mercado Pago; después ejecuta con acceso a la base correcta: npm run community:grant-ad-free -- UUID mp:ID --verified. No concede acceso por query string, captura de pantalla o declaración del visitante. Un pago no se usa en varias cuentas. Operación idempotente: no modifica beneficios existentes. No hay endpoint de autoactivación ni secreto administrativo público. Aportes anteriores verificables también son elegibles.

## Límites actuales
No se implementa asociación automática de pagos ni revocación automática por reembolso o disputa; requiere atención operativa. Para automatizar, migrar a checkout autenticado por cuenta con registro durable de aporte y webhook firmado, sin reutilizar el ledger de membresías. No se promete activación instantánea en la interfaz. Configuración de producción y publicación pendientes.

## Verificación
Build y lint backend aprobados; 102 pruebas unitarias aprobadas. Dos integraciones con PostgreSQL aislado aprobadas: migración, JWT obligatorio, aislamiento de beneficio, idempotencia y pago único por cuenta. Build desarrollo frontend y TypeScript de tests aprobados. No se desplegó ni habilitó publicidad real; ADS_ENABLED=false y patrocinador vacío. No se verificó diseño en navegador en esta tarea.

## AdSense · 26/11/2026
Se agrega ADS_PROVIDER=adsense como alternativa al patrocinio directo. ADSENSE_CLIENT_ID debe tener formato ca-pub- seguido por 16 cifras y ADSENSE_SLOT_ID debe ser numérico. Son identificadores públicos, no claves. ADS_ENABLED continúa false hasta aprobación del sitio y configuración correcta de políticas/consentimiento. El servidor no envía slots ni patrocinadores a cuentas adFree, ni cuando faltan identificadores.

Se usa exclusivamente bloque manual responsive de Google, cargado tras elección del usuario elegible. Sin Auto Ads ni script global en index.html: evita anuncios globales fuera de los espacios controlados. No pulsar anuncios propios para probarlos ni generar impresiones artificiales. El proveedor decide disponibilidad y relleno, por lo que puede no aparecer un anuncio aunque el bloque esté configurado. Los errores o bloqueo del script no impiden usar el CRM. Al retirar el componente no se garantiza descargar el código Google ya ejecutado; el beneficio evita renderizar bloques y nuevas cargas para cuentas reconocidas como aportantes.

Antes de activar: cuenta AdSense, sitio aprobado y acceso del rastreador al contenido permitido; revisar si el panel privado es elegible sin entregar datos reales de clientes a un rastreador. Crear unidad Display responsive, completar variables y publicar ads.txt con el publisher ID real proporcionado por Google. No se genera ads.txt ficticio. Para tráfico de EEE/Reino Unido/Suiza configurar una CMP certificada por Google y revisar requisitos aplicables: el aviso sencillo del componente NO sustituye esa CMP. No activar globalmente hasta resolverlo. No se creó una cuenta ni se aceptaron términos en nombre del titular.

La participación en AdSense es gratuita; no se garantiza aprobación ni ingresos. Fuentes: https://support.google.com/adsense/answer/32850 y https://support.google.com/adsense/answer/1346295

## Ubicaciones revisadas · 26/11/2026
Por decisión del titular, la publicidad se limita a /presupuestos/nuevo, /proyectos/nuevo, /cobros/nuevo y /clientes/nuevo (también con query y fragment). Se elimina de panel y listados; edición y detalle no muestran anuncios. Los aportantes acreditados siguen excluidos. La carga no intercepta guardar, no exige clics ni ver un anuncio para operar y los documentos imprimibles no incluyen publicidad.

El titular sugirió pantalla completa. No se implementa una ventana emergente propia con un bloque Display: el formato oficial de pantalla completa de AdSense es Vignette, gestionado por Google entre navegaciones. No se promete una impresión por cada creación ni control exacto de esos disparadores en esta SPA. Se conserva por ahora el bloque integrado manual en las cuatro vistas. Vignette/Auto Ads no están habilitados; su activación requiere revisar compatibilidad de exclusiones y protección de aportantes antes de cambiar el modelo. Fuente: https://support.google.com/adsense/answer/16531962

## Publicidad discreta en panel y listados · 26/11/2026
El titular vuelve a incluir panel y listados, con una única franja compacta debajo del contenido principal. Patrocinio textual con bordes y colores del tema, sin animación, overlays ni espacio reservado si no hay campaña. AdSense compacto usa tamaños de contenedor por viewport: 250x50 móvil estrecho, 320x50 desde 400px y 728x90 desde 900px. No se recorta el anuncio ni se oculta una parte del creativo; el bloque debe configurarse en AdSense para tamaños compatibles. La ocupación total también incluye etiqueta y padding. Al rechazar la carga, el aviso desaparece de la vista.
Las cuatro pantallas de creación conservan sus espacios integrados. Edición, detalles, autenticación y documentos impresos siguen excluidos. Aportantes permanentes no reciben anuncios. Pendiente aprobación/configuración AdSense y revisión visual con anuncios reales; cambios locales.

## Configuración de cuenta AdSense · 26/11/2026
Cuenta del titular ya creada; editor pub-4978005946667538. Sitio velora-web-0bwz.onrender.com requiere revisión. Unidad Display responsive creada: Bakrivo - Bloque manual, slot 9025615680. Auto Ads observados desactivados. Se prepararon metaetiqueta google-adsense-account y src/public/ads.txt con el registro mostrado por Google; no se añade script global. .env local configura IDs reales y proveedor adsense, conservando ADS_ENABLED=false. Pendiente publicar archivos, verificar propiedad y solicitar revisión; perfil de pagos obligatorio aún pendiente. No se declara el sitio verificado hasta observar confirmación de Google.
