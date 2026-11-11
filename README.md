# MercadoLibre Excel Automático

Extensión experimental de Chrome para preparar la selección de campos y publicaciones en la página de edición masiva de MercadoLibre Venezuela.

## Primera versión: prueba sin descarga

La extensión agrega un panel en la página de edición en Excel. Al pulsar **Aplicar selección y comprobar**, intenta seleccionar:

- Precio
- Estado
- SKU
- Categoría
- En tu depósito
- Todas las categorías disponibles
- Publicaciones activas, dejando desmarcados otros estados reconocibles

La extensión **no descarga la planilla**, no cambia precios ni cantidades y no modifica filtros de envío.

## Instalar para probar

1. Descarga o clona este repositorio.
2. En Chrome abre `chrome://extensions`.
3. Activa **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida**.
5. Selecciona la carpeta `extension`.
6. Abre la página de edición en Excel de MercadoLibre Venezuela y pulsa **Aplicar selección y comprobar**.

## Limitaciones conocidas

MercadoLibre puede cambiar la estructura de su página. La extensión usa etiquetas y encabezados visibles para localizar controles; por eso el informe distingue lo que pudo confirmar de lo que no pudo localizar. No debe considerarse una selección confirmada hasta revisar el informe y la página.

La extensión no envía datos a servidores externos, no lee ni almacena contraseñas y no requiere permisos para acceder a otras páginas.

## Archivos

- `extension/manifest.json`: configuración Manifest V3.
- `extension/content.js`: panel y automatización local de la selección.
