# Estado actual — handoff para reimplementación en Quartz 4 + Remark 42

> Resumen ejecutivo de la implementación actual (Wiki.js 2.5) para reescribir la plataforma usando **Quartz 4** (SSG) + **Remark 42** (comentarios self-hosted).
> Fecha del snapshot: 2026-04-25.

---

## 1. Producto y alcance

**urgpedia** = red de manuales clínicos de urgencia para clínicas Andes Salud. Implementación inicial (CASPM Puerto Montt) en `caspm.urgpedia.cl`. Modelo: una landing pública (`urgpedia.cl`) que dirige a subdominios por clínica.

**Audiencia**: médicos y residentes de urgencia (uso interno). **No** es contenido público abierto — requiere autenticación.

**Branding**:
- Color institucional: `#04488e`
- Logos en `assets/`: `urgpedia-icon.svg` (blanco sobre azul), `urgpedia-icon-blue.svg` (azul sobre blanco), `urgpedia-favicon.svg`
- Estética objetivo: Substack-like — limpia, columna 780px, serif para titulares, azul institucional reservado para H1 / links / acentos puntuales

---

## 2. Stack actual (a reemplazar)

| Componente | Tecnología actual | Reemplazo propuesto |
|---|---|---|
| CMS / wiki | **Wiki.js 2.5** (Vue/Vuetify SPA + PostgreSQL) | **Quartz 4** (SSG estático desde markdown) |
| Comentarios | Wiki.js comments (built-in, en Postgres) | **Remark 42** (Docker, OAuth) |
| Auth | Auth0 (Google connection) | A definir — ver §6 |
| Reverse proxy | Caddy 2 | Caddy 2 (mantener) |
| Hosting | Oracle Cloud Free Tier · Ubuntu 22.04 · IP en `.env.local` | Mismo servidor |
| DB | PostgreSQL 15 | Eliminar (Quartz no usa DB; Remark 42 usa BoltDB embebido) |
| Backup contenido | Git Storage (sync bidireccional, repo privado, cron 10 min) | El repo ES el contenido (Quartz lee MD del repo) |

---

## 3. Estructura de contenido

Path hierarchy actual (locale `es`, todas las páginas bajo `/es/...`):

```
/es/home                          (landing del wiki, no aparece en sidebar)
/es/introduccion/...
/es/el-servicio/...
/es/interconsultores/...
/es/servicios-de-apoyo/...
/es/marco-legal/...
/es/protocolos-operativos/...
/es/protocolos-calidad/...
/es/protocolos-clinicos/
   ├── adulto/                    (Decreto 34 MINSAL — adulto)
   ├── pediatrico/                (Decreto 34 — pediátrico/neonatal)
   ├── por-patologia/
   │   └── procedimientos/        (sub-categoría dentro de patología)
   ├── por-presentacion/          (por presentación clínica)
   └── (orphans en root → "Protocolos Clínicos" sin sub-grupo)
/es/calculadoras/...
```

Convención de títulos: páginas comienzan con `§N` (e.g. `§1 Triage`, `§2 RCP`, …) para ordenamiento natural dentro de cada sección. Ya implementado un natural-sort que parsea `§\d+` correctamente.

**Tags**: cada página tiene tags libres (e.g. `marco-legal`, `ley-de-urgencia`, `fonasa`). Routing de tag: `/t/<slug>`. Tag combinado funciona (`/t/a/b/c` = páginas con todos los tags).

**Source of truth de contenido**: actualmente sincronizado a `git@github.com:nicoveraz/urgpedia-caspm-content.git` (privado, deploy key SSH). En Quartz 4 ese repo se vuelve el único contenedor del contenido — los `.md` viven directamente en `content/`.

---

## 4. Decisiones de diseño visual a preservar

Implementadas en `theme/custom.css` (~600 líneas peleando contra Vuetify) + `theme/inject-head.html`. Lo importante a replicar en Quartz:

### Layout
- Columna de contenido **780px max-width**, centrada
- Sidebar izquierdo (navegación), aside derecho (TOC + tags + comentarios + autor)
- En desktop: sidebar 3/12, contenido 9/12 (con aside dentro)
- Mobile: drawer colapsable a **78vw** (no 256px default)

### Tipografía
- Body: system sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`)
- Headings: serif (`Charter, "Iowan Old Style", Georgia, serif`) con `letter-spacing: -0.01em`
- Tamaño base: 17px desktop / 16px mobile, line-height 1.7

### Color
- **H1 = único elemento en azul institucional** (`#04488e`)
- H2+ en `#1a2332` (gris muy oscuro)
- Texto body `#1a2332`, secundario `#57606a`
- Background blanco; sidebar bg `#fbfbfa` (gris hueso)
- Borders `#e1e4e8`
- Brand blue **NO** debe ser dominante — solo H1, links, FABs outlined, sidebar item activo (tint sutil 8% opacity)

### Sidebar (accordion single-open)
- Headers de sección colapsables con chevron
- Solo una sección abierta a la vez (single-open accordion)
- Sub-niveles L2 (e.g. dentro de "Protocolos Clínicos": Procedimientos, Por Patología, Adulto, Pediátrico)
- Highlight de página activa
- Botón "cerrar todo"
- Iconos MDI (Material Design Icons) en headers L1
- Quartz 4 trae `Explorer` component que ya hace mucho de esto — adaptar estilo

### Tags (chips)
- Background `rgba(4,72,142,0.08)` (azul al 8%)
- Border `rgba(4,72,142,0.25)`, texto `#04488e`
- Hover: bumps a `.14` / `.4`

### Blockquote
- Border-left 4px `#04488e`, bg `rgba(4,72,142,0.05)`
- Padding `0.6em 1em`, border-radius `0 4px 4px 0`
- **Sin** el ícono de comilla decorativa (Wiki.js lo agregaba con MDI font, no lo queremos)

### FABs (botones flotantes acción primaria)
- Outlined: `border: 1.5px solid #04488e`, fondo blanco, ícono azul, hover bg `rgba(4,72,142,0.05)`

### Top header
- Fondo blanco, sin border-bottom prominente, logo azul (`urgpedia-icon-blue.svg`), título `#04488e` weight 600
- Iconos en azul institucional, no negros

### Footer
- Solo `© <año> Urgpedia. Todos los derechos reservados.`
- Sin "Powered by ..." (eliminado en Wiki.js via JS injection — en Quartz simplemente no incluirlo)

---

## 5. Comportamiento dinámico crítico

### 5.1 Auto-navegación (sidebar desde contenido)
**Hoy**: script Python (`scripts/auto_nav.py`) consulta tabla `pages` del Postgres cada 10 min via cron, agrupa por path-prefix según constante `SECTIONS`, escribe JSON a tabla `navigation`, reinicia Wiki.js. Hash cache en `/tmp/.auto_nav_hash` para skip si no hay cambios.

**En Quartz**: el filesystem ES la fuente — Quartz 4 genera el sidebar automáticamente vía `Explorer` component leyendo el árbol de archivos. La constante `SECTIONS` (con labels customizados, iconos MDI, sub-grupos L2) hay que portarla a la config de Quartz (probablemente custom Explorer config o frontmatter por carpeta con metadata).

Ver `scripts/auto_nav.py` para mapping prefix → label + iconos. Subgrupos L2 importantes:
```
/es/protocolos-clinicos/
   por-patologia/procedimientos  → "Procedimientos"
   por-presentacion              → "Por Presentación Clínica"
   por-patologia                 → "Por Patología"
   adulto                        → "Adulto — Decreto 34"
   pediatrico                    → "Pediátrico / Neonatal — Decreto 34"
```
Orden importa: prefijos más específicos primero.

### 5.2 Single-open accordion
**Hoy**: JS standalone en `theme/inject-head.html` (data-urgpedia-accordion-v4). Click handler en `.wk-hdr` → cerrar otras secciones via DOM manipulation (remover `wk-open`, `display:none` en siblings hasta el siguiente `.wk-hdr`).

**En Quartz**: Explorer trae folder collapse out-of-the-box pero no fuerza single-open. Hay que adaptar el componente o agregar JS que escuche clicks y cierre siblings (lógica trivialmente portable).

### 5.3 Búsqueda
**Hoy**: Wiki.js search built-in (Postgres FTS).
**Quartz**: `flexsearch` plugin built-in (índice client-side).

---

## 6. Auth — pendiente de definir

Wiki.js tiene auth integrada (Auth0 strategy). Quartz es estático y NO tiene auth. Opciones:

| Opción | Pros | Contras |
|---|---|---|
| **Caddy auth_request + oauth2-proxy** | Reusa Auth0 / Google directo, sin tocar Quartz | Setup adicional, oauth2-proxy ante todo recurso |
| **Cloudflare Access** | Cero código, Auth0 SAML compatible | Vendor lock, requiere mover DNS a CF |
| **Caddy basicauth** | Trivial | Solo para uso interno chico, sin SSO |
| **VPN-only (Tailscale)** | Sin auth web, máxima simplicidad | Requiere cliente en cada device |

**Recomendación tentativa**: oauth2-proxy + Auth0 (mantiene SSO existente, login único entre clínicas). Auth0 tenant: `dev-0zpeshonra8ull1d.us.auth0.com`, Strategy UUID `81ff3df8-2a3f-4073-b335-38d113f6da22`.

Decisión a tomar antes de migración.

---

## 7. Comentarios — Remark 42

**Hoy**: comments built-in de Wiki.js. Cada página tiene un `#discussion` block con threading, login compartido con Auth0.

**Reemplazo**: Remark 42 (https://remark42.com).
- Docker container, BoltDB embebido (no Postgres separado)
- Auth: anon + OAuth (Google, GitHub, Microsoft, etc.) — alinear con auth principal del wiki
- Embed: snippet JS por página + div `<div id="remark42"></div>`
- Moderación: dashboard admin propio
- En Quartz: agregar el snippet al `Footer` o `ContentBody` component, scope por slug (`url` config)

Configuración mínima a portar:
- Misma OAuth provider que el resto del sitio (idealmente Auth0 pero Remark42 no soporta Auth0 nativamente — alternativas: Google directo, o configurar como OIDC genérico si es posible)
- Idioma `es`
- Tema claro forzado (consistente con wiki)
- Hostnames permitidos: `caspm.urgpedia.cl`

---

## 8. Migración de contenido

Wiki.js exporta a markdown via Git Storage, ya activo. El repo `urgpedia-caspm-content` tiene los `.md` directamente — esa es la fuente de migración.

Diferencias menores a normalizar:
- Wiki.js mete frontmatter propio (`<!-- TITLE: ... -->`) — convertir a YAML frontmatter estándar de Quartz (`title:`, `tags:`, `description:`, `lastmod:`)
- Links internos: `/es/marco-legal/ley-de-urgencia` (con `/es/` prefix) → en Quartz típicamente `[[ley-de-urgencia]]` (wikilinks) o paths relativos sin locale
- Imágenes: hoy en `/uploads/` de Wiki.js — mover a `content/_assets/` o similar
- Tags: en Wiki.js como entidad separada en DB → en Quartz como `tags: [a, b, c]` en frontmatter

Estimar ~50–80 archivos `.md` (15 ya importados manualmente, resto creado/editado en Wiki.js).

---

## 9. Infra a mantener / cambiar

**Mantener**:
- Servidor Oracle Cloud (Ubuntu 22.04, IP en `.env.local`)
- Caddy 2 + Let's Encrypt
- Dominio `caspm.urgpedia.cl` y landing `urgpedia.cl`
- Repo principal `manual-urgencia-andes-salud` (este, infra/config)
- Repo de contenido `urgpedia-caspm-content` (privado)
- Branding (`assets/`)

**Eliminar**:
- Wiki.js container + Postgres container
- Cron de auto_nav.py + script
- Inject-head.html (los hacks)
- Custom.css gigante (re-implementar mucho más simple en Quartz SASS)
- Git Storage sync (no aplica — el contenido VIVE en el repo)

**Agregar**:
- Quartz 4 build pipeline (Node.js, `npx quartz build`)
- Servir `public/` (output) via Caddy `file_server`
- Container Remark 42
- Container oauth2-proxy (si se opta por esa ruta de auth)
- GitHub Action o cron pull en server: detectar push a content repo → rebuild Quartz → recargar sitio

---

## 10. Caddyfile actual (referencia, requiere reescritura completa)

```caddy
caspm.urgpedia.cl {
    handle /assets/* { root * /srv/urgpedia; file_server }
    @login path /login
    redir @login /login/81ff3df8-2a3f-4073-b335-38d113f6da22 302
    reverse_proxy localhost:3000        # ← Wiki.js
}
```

Post-migración (esquema):
```caddy
caspm.urgpedia.cl {
    # 1. Auth gate (oauth2-proxy en :4180)
    forward_auth localhost:4180 { ... }

    # 2. Comentarios Remark 42
    handle /remark42/* { reverse_proxy localhost:8080 }

    # 3. Sitio estático Quartz
    root * /srv/urgpedia/quartz/public
    file_server
    try_files {path} {path}/ /404.html
}
```

---

## 11. Archivos clave del repo actual (referencia)

```
manual-urgencia-andes-salud/
├── theme/
│   ├── custom.css              # ~650 líneas — referencia visual
│   ├── inject-head.html        # JS para favicon, accordion, footer-strip
│   └── nav-accordion.js        # versión standalone
├── scripts/
│   ├── auto_nav.py             # SECTIONS config L1+L2, iconos MDI
│   └── create_nav_accordion.py # inyección DOM (no aplicará en Quartz)
├── docs/
│   ├── ESTADO-ACTUAL.md        # estado pre-migración (más detalle infra)
│   ├── DEPLOYMENT.md           # despliegue Wiki.js (legacy)
│   └── WIKI-SCHEMA.md          # estructura contenido
├── assets/                     # logos SVG (mantener)
├── landing/index.html          # urgpedia.cl directorio (mantener separado)
└── docker-compose.yml          # Wiki.js stack (a reemplazar)
```

---

## 12. Checklist mínimo de migración

- [ ] Inicializar Quartz 4 en nuevo subdir (e.g. `quartz/`) o repo
- [ ] Apuntar `content/` al repo `urgpedia-caspm-content` (submodule o sync)
- [ ] Portar `SECTIONS` de `auto_nav.py` a Explorer config Quartz (labels + iconos + sub-grupos)
- [ ] Replicar paleta + tipografía + spacings (§4) en theme SASS
- [ ] Implementar single-open accordion en Explorer
- [ ] Decidir y montar auth (§6)
- [ ] Montar Remark 42 + integrar embed en `ContentBody`
- [ ] Convertir frontmatter Wiki.js → Quartz (script de migración una vez)
- [ ] Caddy config nueva (§10)
- [ ] Cron / webhook: push a content repo → rebuild
- [ ] Verificar: links internos resuelven, tags funcionan, búsqueda funciona, mobile drawer 78vw, footer sin "Powered by"
- [ ] Cutover: DNS sigue apuntando a misma IP, solo cambia el backend tras Caddy

---

## 13. Riesgos / preguntas abiertas

- **Auth**: si oauth2-proxy + Auth0 no encaja, ¿pasamos a Google directo? Implica re-onboarding de usuarios.
- **Remark 42 y SSO**: idealmente comparten provider con el wiki — verificar compatibilidad OIDC.
- **Editing UX**: Wiki.js tenía editor visual. Post-migración los autores editan markdown directo (PR a content repo) o vía algún CMS headless (Decap CMS / TinaCMS) sobre el repo. Decidir: ¿quién edita y cómo?
- **Comentarios existentes**: la migración de threads de Wiki.js comments → Remark 42 no es trivial. Probable: descartar comentarios actuales (uso interno, baja densidad).
- **Búsqueda**: Quartz flexsearch indexa en build — sitios grandes pueden tardar. Verificar tamaño de índice.

---

> Para más detalle sobre la implementación actual ver `docs/ESTADO-ACTUAL.md`, `theme/custom.css`, `scripts/auto_nav.py`, y `theme/inject-head.html`.
