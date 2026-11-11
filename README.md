# MercadoLibre Excel Automático

Extensión de Chrome para preparar y descargar la planilla de edición masiva de publicaciones de MercadoLibre Venezuela.

## Funcionamiento manual

Al abrir la página de edición en Excel, la extensión:
- Marca Precio, Estado, SKU, Categoría y En tu depósito.
- Desmarca Forma de entrega y costo de envío, Tipo de publicación y Condición.
- Selecciona Todas las categorías y publicaciones Activas.
- Comprueba las selecciones y pulsa Descargar únicamente si todas quedaron verificadas.
- Muestra un panel con el resultado y permite repetir la selección.

## Automatización en Windows

La extensión también puede programar descargas aunque Chrome esté cerrado:

- Una ejecución al iniciar sesión en Windows (independiente de los horarios diarios).
- Uno o varios horarios diarios. Por defecto se propone 12:00.
- Los horarios se agregan, modifican o eliminan desde el botón de la extensión.
- Windows abre Chrome usando el perfil habitual, sin guardar ni solicitar credenciales. Si ya hay otras pestañas abiertas, la pestaña automática intenta quedar en segundo plano.
- La extensión espera la descarga real del archivo. Si Chrome confirma que terminó, cierra solo la pestaña automática y muestra una notificación.
- Si la sesión expiró, aparece un CAPTCHA, falla la selección o no se confirma la descarga, deja la pestaña abierta y muestra un aviso.

La programación requiere Windows, Google Chrome instalado y la extensión cargada. El equipo debe estar encendido y el usuario debe haber iniciado sesión; no se ejecuta mientras Windows está apagado ni antes de iniciar sesión.

### Instalación inicial

1. Descarga y descomprime el ZIP del repositorio.
2. En Chrome abre `chrome://extensions` y activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `extension`.
4. Copia el ID que aparece en la tarjeta de la extensión.
5. Haz clic derecho en `Instalar-Automatizacion.ps1` y selecciona **Ejecutar con PowerShell**. También puedes abrir PowerShell en la carpeta y ejecutar:
   `powershell -ExecutionPolicy Bypass -File .\Instalar-Automatizacion.ps1`
6. Pega el ID de la extensión cuando lo solicite el instalador.
7. Pulsa el icono de la extensión, revisa los horarios y pulsa **Guardar programación**.

El instalador registra un pequeño host local de Chrome y crea las tareas programadas de Windows para el usuario actual. No requiere guardar contraseñas de MercadoLibre. Si cambias la ubicación de la carpeta de la extensión y Chrome genera otro ID, debes volver a ejecutar el instalador con el nuevo ID.

## Archivos

- `extension/manifest.json`: permisos y configuración Manifest V3.
- `extension/content.js`: selección, verificación y clic de descarga.
- `extension/background.js`: supervisión de descargas, cierre seguro de pestaña y notificaciones.
- `extension/options.html` / `extension/options.js`: programación de horarios.
- `windows/native-host.ps1`: integración local con el Programador de tareas.
- `windows/run-download.ps1`: apertura de Chrome.
- `Instalar-Automatizacion.ps1`: instalación del host nativo en Windows.

## Seguridad y límites

- No almacena credenciales ni envía datos a servidores externos.
- No modifica precios ni cantidades; solo descarga la planilla.
- No cierra pestañas abiertas manualmente.
- Solo cierra la pestaña automática cuando Chrome informa que el archivo Excel terminó de descargarse.
- Si no puede identificar con seguridad la descarga, no cierra la pestaña.
- La página y sus controles pueden cambiar; revisa el panel si MercadoLibre modifica su interfaz.
