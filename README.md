# MercadoLibre Excel Automático

Extensión experimental de Chrome para preparar automáticamente la selección de campos y publicaciones en la página de edición masiva de MercadoLibre Venezuela.

## Cómo trabaja

MercadoLibre presenta las opciones en **dos listas desplegables independientes**. La extensión las procesa en secuencia: abre la primera, aplica los campos y la cierra; después abre la segunda y aplica categorías y estado de publicaciones. No intenta mantener ambas listas abiertas al mismo tiempo.

### Primera lista: datos que vas a modificar

Deben quedar marcados:
- Precio
- Estado
- SKU
- Categoría
- En tu depósito

Deben quedar desmarcados:
- Forma de entrega y costo de envío
- Tipo de publicación
- Condición

### Segunda lista: publicaciones que quieres incluir

- En categorías, marca únicamente **Todas**.
- En estado de publicaciones, deja seleccionado **Activas**.

La extensión se ejecuta automáticamente al abrir la página y conserva un botón para repetir la selección. Muestra un informe con los controles que pudo confirmar.

## Límites de esta versión

- No descarga la planilla.
- No cambia precios ni cantidades.
- No modifica filtros de envío.
- No envía datos a servidores externos ni almacena credenciales.

La estructura de MercadoLibre puede cambiar. Comprueba el informe y el estado visible de las casillas antes de continuar.

## Instalar o actualizar

1. Descarga el ZIP del repositorio y descomprímelo.
2. Abre `chrome://extensions`.
3. Activa **Modo de desarrollador**.
4. Si ya estaba instalada, pulsa **Actualizar** o recarga la extensión.
5. Si es la primera instalación, pulsa **Cargar descomprimida** y selecciona la carpeta `extension`.
6. Abre la página de edición en Excel de MercadoLibre Venezuela.

## Archivos

- `extension/manifest.json`: configuración Manifest V3.
- `extension/content.js`: automatización secuencial, panel e informe.
