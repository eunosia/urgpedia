# Migración URGpedia: Wiki.js → Astro Starlight

Estado: **contenido real compilando**. El sitio Starlight construye los **136
protocolos reales** traídos por *fetch* desde el repo de contenido (142 páginas
totales con índices, blog y páginas de tags). Falta solo el despliegue
(hosting/auth/CI), documentado pero no instalado en esta rama.

- Repo del **sitio** (este): la app Starlight que publica.
- Repo de **contenido** (`urgpedia-caspm-content`): fuente de verdad de los
  protocolos en Markdown. Read-only para esta tarea. Se trae por *fetch* desde
  `main` en cada build (sin submódulo, sin rama `published`).

---

## 1. Inventario de protocolos

El piloto define el patrón; el resto se porta en cola siguiendo el mismo molde.

| Protocolo | Estado | Calculadora asociada |
|---|---|---|
| Cetoacidosis diabética (DKA) | **Piloto** (patrón validado) | `DkaCalculator.astro` |
| Shock séptico | **Portado** (2.º; patrón estabilizado) | `SepsisCalculator.astro` (qSOFA, PAM, bolo) |
| Síndrome coronario agudo (SCA) | En cola | Por definir (p. ej. score de riesgo) |
| Ataque cerebrovascular (ACV) | En cola | Por definir (p. ej. ventana, NIHSS) |
| Tromboembolismo pulmonar (TEP) | En cola | Por definir (p. ej. Wells, PESI) |

> El inventario completo (50–80 archivos) se levanta desde el repo de contenido
> al ejecutar la migración. Aquí se listan solo los de la primera cola. Con DKA
> (piloto) y shock séptico (segundo) el patrón queda estabilizado: SCA, ACV y
> TEP se portan con el mismo molde.
>
> **Validación clínica pendiente** en ambas calculadoras: el mantenedor debe
> validar fórmulas, umbrales y dosis (en especial el bolo de 30 mL/kg de shock
> séptico) contra el protocolo local antes de publicar.

---

## 2. Patrón de portado desde Wiki.js

### 2.1 Export de Markdown

Wiki.js ya exporta el contenido a Markdown vía Git Storage; ese repo
(`urgpedia-caspm-content`) es la base. El portado normaliza cada archivo:

### 2.2 Frontmatter

| Wiki.js | Starlight | Nota |
|---|---|---|
| `<!-- TITLE: ... -->` / frontmatter propio | `title:` | Obligatorio. |
| descripción | `description:` | Recomendado (SEO + buscador). |
| orden por prefijo `§N` en el título | `sidebar.order:` (número) | **Decidido:** el `§N` NO se conserva en el título visible; el orden pasa a `sidebar.order`. Ver §2.6. |
| `lastmod` | `lastUpdated:` o derivado de git | Starlight puede tomarlo de git. |
| tags (entidad en DB, routing `/t/`) | `tags:` (array) | **Decidido:** se conservan como `tags` en frontmatter; descubrimiento por "Índice por tema". Ver §2.6. |

Ejemplo de frontmatter de destino:

```yaml
---
title: Cetoacidosis diabética (DKA)
description: Manejo en urgencias de la cetoacidosis diabética del adulto.
sidebar:
  order: 1
tags:
  - endocrino-metabólico
  - adulto
  - calculadora
---
```

### 2.3 Ubicación en el sidebar

La **ruta del archivo** dentro de `src/content/docs/<sección>/` determina el
grupo del sidebar. Las secciones §N están preconfiguradas en `astro.config.mjs`
(autogenerate por carpeta). Subgrupos de Protocolos Clínicos mediante carpetas
anidadas:

```
src/content/docs/protocolos-clinicos/
├── adulto/
├── pediatrico/
├── por-patologia/
│   └── procedimientos/
└── por-presentacion/
```

El orden dentro de cada grupo se controla con `sidebar.order` en el frontmatter.

### 2.4 Links internos e imágenes

- Links `/es/marco-legal/ley-de-urgencia` → ruta por *slug* de Starlight, sin
  prefijo `/es/` (locale raíz). Revisar enlaces relativos al portar.
- Imágenes de `/uploads/` de Wiki.js → mover a `src/assets/` (optimizadas por
  Astro) o relativas a la página, y actualizar las referencias.

### 2.5 Calculadora como componente

Patrón validado con el piloto DKA:

1. La lógica JS embebida de la calculadora Wiki.js se porta a un **componente
   Astro reutilizable** en `src/components/calculators/` (vive en el repo del
   sitio, se versiona). Sin framework: markup + `<script>` cliente.
2. La página del protocolo importa el componente y lo usa:

   ```mdx
   ---
   title: Cetoacidosis diabética (DKA)
   ---
   import DkaCalculator from '@/components/calculators/DkaCalculator.astro';

   <DkaCalculator />
   ```

3. **La página que importa un componente nativo debe ser `.mdx`** (no `.md`).
   Las calculadoras embebidas de Wiki.js (`<script>` inline) siguen en `.md` por
   *passthrough*; ver §2.7.
4. Las calculadoras nativas son **piloto**: las fórmulas requieren validación
   clínica y verificación contra el protocolo local antes de producción.

#### Shell común (generalización)

Al portar el segundo protocolo (shock séptico) se extrajo el shell visual
compartido a **`src/components/calculators/calculator.css`** (clases `.calc-*` y
severidad genérica por `data-level` = `high|mid|low`). En vez de duplicar
estilos, cada calculadora importa ese CSS y aporta solo sus campos y fórmulas.

- **Decisión deliberada**: la **lógica clínica NO se generaliza** en un motor
  configurable; queda explícita y co-localizada en cada componente para que el
  mantenedor la revise de forma aislada. Solo se comparte la presentación.
- Cada calculadora mapea su categoría clínica al `data-level` del shell (p. ej.
  DKA: grave→high; qSOFA: ≥2→high).

Inventario de componentes de calculadora (en el repo del sitio):

| Componente | Protocolo | Cálculos |
|---|---|---|
| `DkaCalculator.astro` | Cetoacidosis diabética | Sodio corregido, anion gap, osmolalidad efectiva, severidad ADA |
| `SepsisCalculator.astro` | Shock séptico | PAM, qSOFA, bolo de cristaloides |
| `calculator.css` | — (shell común) | Estilos y severidad por `data-level` |

> Los componentes nativos viven en el repo del sitio y se versionan. Las páginas
> de **muestra** que los embebían eran solo locales (gitignored) para validar el
> render; `content:sync` con contenido real las reemplaza por los protocolos del
> repo de contenido. Para volver a probar un componente nativo, crear una página
> `.mdx` de muestra en local (no se commitea).

---

## 2.6 Decisiones de diseño (preguntas abiertas resueltas)

Resueltas con DKA y shock séptico a la vista; aplican a todo el portado.

### Orden de las páginas

- **Agrupación**: por **estructura de carpetas**. La carpeta de sección define
  el grupo del sidebar (autogenerate en `astro.config.mjs`); las subcarpetas
  definen subgrupos. No se usa el `§N` para agrupar.
- **Orden dentro de un grupo**: por **`sidebar.order`** (entero) en el
  frontmatter. Menor = más arriba.
- **Título visible**: **sin** el prefijo `§N`. El número del manual Wiki.js
  (`§1`, `§2`, …) se traslada a `sidebar.order`; el título queda limpio (mejor
  para el buscador y la lectura). Ejemplo: `§3 RCP` → `title: RCP` +
  `sidebar.order: 3`.

### Tags / categorías

Starlight docs no trae tags nativos, pero el esquema de contenido del sitio se
extendió con `blogSchema`, por lo que las páginas aceptan `tags:` en frontmatter.

- **Cómo se agrupan**: cada protocolo declara `tags:` con un **vocabulario
  controlado**. Dos ejes:
  - **Área clínica**: `endocrino-metabólico`, `infeccioso`, `cardiovascular`,
    `neurológico`, `respiratorio`, …
  - **Transversales**: `shock`, `procedimiento`, `calculadora`, `adulto`,
    `pediátrico`, `tiempo-dependiente`, …
- **Cómo se descubren**: página **"Índice por tema"** en `/temas/`
  (`src/components/TagIndex.astro` + `src/content/docs/temas.mdx`), que lee la
  colección de docs y lista los protocolos agrupados por tag. Más el buscador
  (Pagefind indexa los tags). El sidebar sigue siendo por sección; los tags son
  un eje de descubrimiento ortogonal.
- **Descartado**: el routing combinable de Wiki.js (`/t/a/b/c`, páginas con
  todos los tags). Se anota como posible mejora futura si se necesita filtrado
  multi-tag; por ahora el índice por tema cubre el descubrimiento.

---

## 2.7 Normalización en el sync (Wiki.js → Starlight)

El repo de contenido es un **espejo bidireccional de Wiki.js** (Git Storage):
su frontmatter es de Wiki.js y no compila con el esquema de Starlight. Como el
repo de contenido es **read-only** (Wiki.js empuja directo a `main`), la
adaptación ocurre **en el momento del sync**, no en el repo de contenido.

`scripts/content-sync.sh` hace, después del `rsync`:

1. **Excluye meta del repo de contenido**: `README.md`, `intro-test.md`,
   `*.html`, `docs/`, `scripts/`, `.github/`, `CODEOWNERS` (no son protocolos).
2. **Normaliza el frontmatter** con `scripts/normalize-content.mjs` (idempotente):
   - `tags: "a, b, c"` (string Wiki.js) → `tags: [a, b, c]` (array Starlight).
     Vacío → se omite.
   - `title` / `description` → se re-emiten entre comillas (evita romper por `:`).
   - `date` / `dateCreated` → `lastUpdated` (solo si parsean a fecha válida).
   - Se **descartan** los campos propios de Wiki.js (`published`, `editor`,
     `dateCreated`) y los bloques del RAG (`citas`, `dosis`, `calculadoras`),
     que consume `eunosia-rag`, no el sitio.

El **cuerpo** del documento queda intacto. El contenido sincronizado sigue sin
versionarse en este repo (`.gitignore`); un clon en frío arranca vacío y el
script lo llena.

### Calculadoras embebidas (Wiki.js) vs componentes nativos

Hay dos caminos para las calculadoras, y **conviven**:

- **Embebidas en el contenido**: ~10 protocolos traen `<div data-calc="…">` +
  `<script>` inline desde Wiki.js. En `.md` de Astro ese HTML/JS **pasa al
  output y se ejecuta** en el navegador (verificado en el build). No requiere
  `.mdx` ni cambios; siguen funcionando tal cual.
- **Componentes nativos** (`src/components/calculators/`): para calculadoras
  nuevas o reescritas con mejor UX/validación (DKA, shock séptico). Esas páginas
  sí deben ser `.mdx` para poder importar el componente.

> Validación clínica: las calculadoras embebidas heredan las fórmulas de
> Wiki.js (responsabilidad del autor clínico); las nativas requieren validación
> del mantenedor antes de publicar (ver §1).

---

## 3. Preguntas abiertas

> Tags, orden de páginas, estructura del repo y `.md`/`.mdx` quedaron
> **resueltos** (§2.6 y §2.7).

- **Estructura del repo de contenido** — **resuelto**: los `.md` viven en la
  raíz con subcarpetas por sección (`protocolos-clinicos/por-presentacion/…`),
  sin prefijo de locale `/es/`. `CONTENT_SUBDIR="."`. Cada sección tiene además
  un `.md` de portada (`calculadoras.md`, `el-servicio.md`, …).
- **`.md` vs `.mdx`** — **resuelto** (§2.7): el contenido se queda en `.md`; las
  calculadoras embebidas pasan por *passthrough*. Solo las páginas que importan
  un componente nativo se hacen `.mdx`.
- **Clon privado en build** — **resuelto en código**: `content-sync.sh` soporta
  `CONTENT_TOKEN` (PAT de solo lectura), inyectado por header sin persistirlo en
  disco. Falta solo crear el token y cargarlo como variable de entorno en el host.
- **Despliegue** — pendiente (requiere servicios externos, fuera de esta rama):
  hosting (Cloudflare Pages), auth (Cloudflare Access) y CI cross-repo. Checklist
  paso a paso en `docs/DEPLOYMENT-STARLIGHT.md`; fondo en `docs/hosting-plan.md` y
  `docs/auth-plan.md`. Workflow de deploy-hook de ejemplo en
  `docs/examples/content-repo-deploy.yml`.
- **Calculadoras nativas en cola**: definir fórmulas y validación clínica de
  SCA, ACV y TEP (DKA y shock séptico ya tienen componente piloto).

---

## 4. Cómo correr el sitio localmente

```bash
npm install
npm run content:sync   # trae los protocolos (repo de contenido privado)
npm run dev
```

Sin `content:sync`, el sitio levanta solo el andamiaje (portada provisional y
secciones vacías). Ver `README.md` para más detalle.
