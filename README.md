# MercadoLibre Excel Automático

Extensión experimental de Chrome para preparar automáticamente la selección de campos y publicaciones en la página de edición masiva de MercadoLibre Venezuela.

## Comportamiento de esta versión

Al abrir la página de edición en Excel, la extensión espera a que carguen los controles y aplica la selección automáticamente. También deja un botón para repetir el proceso.

**Campos que deben quedar marcados:**
- Precio
- Estado
- SKU
- Categoría
- En tu depósito

**Campos que deben quedar desmarcados:**
- Forma de entrega y costo de envío
- Tipo de publicación
- Condición

**Categorías:** marca únicamente la opción «Todas»; no marca las categorías individuales.

**Publicaciones:** intenta dejar seleccionado el filtro «Activas».

La extensión no descarga la planilla ni modifica precios, cantidades o filtros de envío.

## Instalar o actualizar en Chrome

1. Descarga el ZIP del repositorio y descomprímelo.
2. Abre `chrome://extensions`.
3. Activa **Modo de desarrollador**.
4. Si ya instalaste una versión anterior, pulsa **Actualizar** en la página de extensiones o vuelve a cargar la extensión.
5. Si es la primera instalación, pulsa **Cargar descomprimida** y selecciona la carpeta `extension`.
6. Abre la página de edición en Excel de MercadoLibre Venezuela.

## Limitaciones

MercadoLibre puede cambiar la estructura de su página. La extensión localiza controles mediante sus etiquetas visibles y muestra un informe de lo que pudo confirmar. Revisa el resultado en la página antes de continuar; si una opción no se reconoce, aparecerá como aviso.

No se envían datos a servidores externos, no se leen ni almacenan contraseñas y no se requieren permisos para otras páginas.

## Archivos

- `extension/manifest.json`: configuración Manifest V3.
- `extension/content.js`: automatización local, panel e informe.
