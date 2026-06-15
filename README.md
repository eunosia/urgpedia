# urgpedia — Red de Manuales de Urgencia

Plataforma de conocimiento clínico para los equipos de urgencia de la **red Andes Salud**. Arranca con la Clínica Andes Salud Puerto Montt (CASPM) y está diseñada para expandirse a las demás clínicas de la red.

El sitio se construye con **Astro + Starlight** y publica un manual de protocolos
clínicos a partir de archivos Markdown.

> El sistema heredado (Wiki.js sobre Oracle Cloud) fue retirado de este repo. Su
> última versión queda preservada en la etiqueta git **`wikijs-legacy`** por si
> se necesita consultarla.

---

## Modelo de contenido

El contenido **no vive en este repositorio**: es la fuente de verdad del repo de
contenido `urgpedia-caspm-content` (privado) y se **trae por fetch** desde su
rama `main` en cada build (sin submódulo, sin rama `published`).

- El **merge de un PR** en el repo de contenido (acto del mantenedor, compuerta
  de revisión clínica) **es el acto de publicar**.
- El contenido sincronizado está en `.gitignore`; solo se versiona el andamiaje
  (portada `index.mdx`, índice por tema `temas.mdx` y los `.gitkeep` de cada
  sección).
- El frontmatter de Wiki.js se **normaliza a Starlight en el momento del sync**
  (`scripts/normalize-content.mjs`), sin modificar el repo de contenido.

## Desarrollo local

```bash
npm install            # dependencias del sitio
npm run content:sync   # trae los protocolos desde el repo de contenido
npm run dev            # servidor de desarrollo en http://localhost:4321
```

Vista de producción:

```bash
npm run content:sync && npm run build && npm run preview
```

> **Clon en frío:** un clon recién hecho solo trae el andamiaje (portada
> provisional y secciones vacías). El contenido real **no aparece hasta ejecutar
> `npm run content:sync`**. El repo de contenido es privado: en local el clone
> usa tus credenciales de git; en CI/hosting se inyecta un token de solo lectura
> vía `CONTENT_TOKEN` (ver `docs/DEPLOYMENT-STARLIGHT.md`).

## Estructura

```
urgpedia/
├── astro.config.mjs              # Config de Starlight (título, locale es, sidebar)
├── src/
│   ├── components/
│   │   ├── TagIndex.astro        # Índice por tema (/temas/)
│   │   └── calculators/          # Calculadoras reutilizables (componentes Astro)
│   └── content/
│       └── docs/                 # Andamiaje versionado + contenido sincronizado
│                                 #   (este último en .gitignore)
├── scripts/
│   ├── content-sync.sh           # Fetch del contenido en build/local
│   └── normalize-content.mjs     # Normaliza frontmatter Wiki.js → Starlight
├── MIGRATION.md                  # Inventario y patrón de portado desde Wiki.js
└── docs/
    ├── DEPLOYMENT-STARLIGHT.md   # Guía de despliegue (Cloudflare Pages + Access)
    ├── auth-plan.md              # Autenticación de lectores (Cloudflare Access)
    ├── hosting-plan.md           # Hosting (Cloudflare Pages + Access)
    ├── keystatic-opcional.md     # Editor visual opcional (a futuro)
    └── examples/                 # Workflow de deploy-hook para el repo de contenido
```

## Despliegue

El sitio se sirve como estático tras autenticación (Cloudflare Pages +
Cloudflare Access). Guía paso a paso en
[`docs/DEPLOYMENT-STARLIGHT.md`](docs/DEPLOYMENT-STARLIGHT.md).

## Branding

| Asset | Uso | Fondo óptimo |
|---|---|---|
| `assets/urgpedia-icon.svg` | Hero / landing | Azul `#04488e` / oscuro |
| `assets/urgpedia-icon-blue.svg` | Nav sobre claro | Blanco / gris claro |
| `assets/urgpedia-favicon.svg` | Browser tab | Cualquiera (autónomo) |

Color primario: `#04488e`.

## Dominios

| Dominio | Descripción |
|---|---|
| `urgpedia.cl` | Landing — directorio de clínicas de la red |
| `caspm.urgpedia.cl` | Manual de Urgencia CASPM Puerto Montt (este sitio) |
| `*.urgpedia.cl` | Futuros subdominios por clínica |

## Licencia

Uso interno — Red Andes Salud · Chile
