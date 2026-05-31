# Migración URGpedia: Wiki.js → Astro Starlight

Estado: **preparación del terreno** (esta rama). No completa la migración.
Valida el patrón con un protocolo piloto (DKA) y documenta auth y hosting.

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
| Shock séptico | En cola | Por definir (p. ej. cálculo de fluidos, qSOFA) |
| Síndrome coronario agudo (SCA) | En cola | Por definir (p. ej. score de riesgo) |
| Ataque cerebrovascular (ACV) | En cola | Por definir (p. ej. ventana, NIHSS) |
| Tromboembolismo pulmonar (TEP) | En cola | Por definir (p. ej. Wells, PESI) |

> El inventario completo (50–80 archivos) se levanta desde el repo de contenido
> al ejecutar la migración. Aquí se listan solo los de la primera cola.

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

3. **La página que embebe un componente debe ser `.mdx`** (no `.md`).
4. Las calculadoras son **piloto**: las fórmulas requieren validación clínica y
   verificación contra el protocolo local antes de producción.

> La página de muestra del piloto vive solo en local (está en `.gitignore`) y no
> se versiona en el repo del sitio. El contenido real llega por `content:sync`.

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

## 3. Preguntas abiertas

> Tags y orden de páginas quedaron **resueltos** en §2.6.

- **Estructura del repo de contenido**: confirmar si los `.md` están en la raíz
  o en una subcarpeta (`CONTENT_SUBDIR` en `content-sync.sh`) y si conservan el
  prefijo de locale `/es/`.
- **Clon privado en build**: el repo de contenido es privado; el build necesita
  credenciales de lectura (ver `docs/hosting-plan.md`).
- **`.md` vs `.mdx`**: las páginas con calculadora deben ser `.mdx`. Definir si
  se renombran en el repo de contenido o se transforman en el sync.
- **Calculadoras en cola**: definir fórmulas y validación clínica de shock
  séptico, SCA, ACV y TEP.

---

## 4. Cómo correr el sitio localmente

```bash
npm install
npm run content:sync   # trae los protocolos (repo de contenido privado)
npm run dev
```

Sin `content:sync`, el sitio levanta solo el andamiaje (portada provisional y
secciones vacías). Ver `README.md` para más detalle.
