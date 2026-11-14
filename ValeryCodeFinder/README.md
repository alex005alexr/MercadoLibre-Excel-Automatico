# Valery Code Finder

Extensión independiente de Chrome, alojada en este repositorio dentro de su propia carpeta. No modifica los archivos de **Excel Automático**.

## Función
- En la página de Publicaciones de MercadoLibre detecta IDs como `#747230109`.
- Compara el ID con la columna **Referencia** de Valery (por ejemplo, `MLV747230109`).
- Muestra el **Código** junto al ID y permite copiarlo con el botón del logo de Valery.
- Indica «Sin código» o advierte si una referencia corresponde a varios códigos.
- Observa resultados cargados dinámicamente.
- Guarda el catálogo localmente en Chrome; no transmite el archivo ni el catálogo.

## Importar
Selecciona la exportación de Valery y pulsa **Importar / actualizar catálogo**. Detecta los encabezados `Código`, `Referencia` y `Nombre`, aunque cambien de posición. Omite filas sin esos campos.

## Instalar
1. Descarga y descomprime el repositorio.
2. Abre `chrome://extensions` y activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona únicamente la carpeta `ValeryCodeFinder`.
4. Abre MercadoLibre Vendedores → Publicaciones.

La librería `xlsx.full.min.js` corresponde a SheetJS Community Edition y se distribuye bajo Apache License 2.0 (ver `LICENSE-SheetJS.txt`).
