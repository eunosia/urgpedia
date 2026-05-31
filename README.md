# urgpedia — Red de Manuales de Urgencia

Plataforma de conocimiento clínico para los equipos de urgencia de la **red Andes Salud**. Arranca con la Clínica Andes Salud Puerto Montt (CASPM) y está diseñada para expandirse a las demás clínicas de la red.

---

## Sitio Starlight (migración en curso)

> Esta es la nueva aplicación del sitio, construida con **Astro + Starlight**.
> Reemplaza a Wiki.js. Las secciones de operación de Wiki.js más abajo
> documentan el **sistema heredado** que se retira al final de la migración.

El sitio publica un manual de protocolos clínicos a partir de archivos Markdown.
El contenido NO vive en este repositorio: es la fuente de verdad del repositorio
de contenido `urgpedia-caspm-content` y se **trae por fetch** desde su rama
`main` en cada build (sin submódulo, sin rama `published`).

### Desarrollo local

```bash
npm install            # dependencias del sitio
npm run content:sync   # trae los protocolos desde el repo de contenido
npm run dev            # servidor de desarrollo en http://localhost:4321
```

Para una vista de producción:

```bash
npm run content:sync && npm run build && npm run preview
```

> **Clon en frío:** un clon recién hecho solo trae el andamiaje (portada
> provisional y secciones vacías). El contenido real de los protocolos **no
> aparece hasta ejecutar `npm run content:sync`**. El repo de contenido es
> privado: `content:sync` necesita credenciales de lectura (ver
> `docs/hosting-plan.md` para cómo se inyectan en el build del host).

### Estructura del sitio

```
urgpedia/
├── astro.config.mjs              # Config de Starlight (título, locale es, sidebar §N)
├── src/
│   ├── components/
│   │   └── calculators/          # Calculadoras reutilizables (componentes Astro)
│   └── content/
│       └── docs/                 # Contenido: andamiaje versionado + contenido
│                                 #   sincronizado (este último en .gitignore)
├── scripts/content-sync.sh       # Fetch del contenido en build/local
├── MIGRATION.md                  # Inventario y patrón de portado desde Wiki.js
└── docs/
    ├── auth-plan.md              # Autenticación de lectores (Cloudflare Access)
    ├── hosting-plan.md           # Hosting (Cloudflare Pages + Access)
    └── keystatic-opcional.md     # Editor visual opcional (a futuro)
```

El contenido sincronizado está en `.gitignore`; solo se versiona el andamiaje
(portada `index.mdx` y los `.gitkeep` de cada sección).

---

## Stack tecnológico (sistema heredado — Wiki.js)

| Componente | Tecnología |
|---|---|
| Wiki / CMS | Wiki.js 2.5 |
| Base de datos | PostgreSQL 15 |
| Autenticación | Auth0 (SSO compartido entre clínicas) |
| Reverse proxy / SSL | Caddy 2 (Let's Encrypt automático) |
| Hosting | Oracle Cloud Free Tier — Ubuntu 22.04 |
| Backup contenido | Git Storage (repo privado, SSH deploy key, sync) |

## Dominios

| Dominio | Descripción |
|---|---|
| `urgpedia.cl` | Landing page — directorio de clínicas de la red |
| `caspm.urgpedia.cl` | Wiki.js — Manual de Urgencia CASPM Puerto Montt |
| `*.urgpedia.cl` | Futuros subdominios por clínica |

## Estructura del proyecto

```
manual-urgencia-andes-salud/
├── assets/                         # SVGs de branding (icon, icon-blue, favicon)
├── landing/index.html              # Landing page urgpedia.cl
├── docs/
│   ├── ESTADO-ACTUAL.md            # Estado técnico completo (referencia)
│   ├── DEPLOYMENT.md               # Guía de primer despliegue
│   └── WIKI-SCHEMA.md              # Estructura de contenido del wiki
├── scripts/
│   ├── auto_nav.py                 # Auto-sync sidebar desde pages table (cron)
│   ├── create_nav_accordion.py     # Inyecta CSS+JS del acordeón wk-*
│   ├── backup.sh                   # Backup cifrado de la DB
│   └── setup-oracle.sh             # Setup inicial Oracle Cloud
├── theme/
│   ├── custom.css                  # Estilos (tipo Substack, columna 780 px)
│   ├── inject-head.html            # Favicon + script accordion-v4 (single-open)
│   └── nav-accordion.js            # Accordion JS standalone (referencia)
├── overrides/                      # login.pug + servers.js montados en wiki
├── docker-compose.yml
└── .env.example
```

## Branding

| Asset | Uso | Fondo óptimo |
|---|---|---|
| `urgpedia-icon.svg` | Hero landing page | Azul `#04488e` / oscuro |
| `urgpedia-icon-blue.svg` | Header Wiki.js · nav landing | Blanco / gris claro |
| `urgpedia-favicon.svg` | Browser tab | Cualquiera (autónomo) |

Color primario: `#04488e`.

## Inicio rápido (desarrollo local)

```bash
git clone https://github.com/nicoveraz/manual-urgencia-andes-salud.git
cd manual-urgencia-andes-salud
cp .env.example .env
# Editar .env con credenciales
docker compose up -d
# Acceder en http://localhost:3000
```

## Operaciones frecuentes (servidor producción)

> Valores de `$SERVER_IP` y `$SSH_KEY_PATH` en `.env.local` (no commitear).

```bash
# SSH
ssh -i $SSH_KEY_PATH ubuntu@$SERVER_IP

# Contenedores
docker ps                               # estado
docker logs wiki --tail 50              # logs Wiki.js
docker restart wiki                     # reinicio rápido

# Base de datos
docker exec wiki-db psql -U wikijs -d wiki

# Caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Sincronización del sidebar (auto-nav)

El sidebar se reconstruye desde la tabla `pages` vía cron cada 10 min. Al crear o borrar páginas, el menú se actualiza solo.

```bash
# Ver preview sin aplicar
python3 /usr/local/bin/auto_nav.py --dry

# Forzar aplicación ignorando cache
python3 /usr/local/bin/auto_nav.py --force

# Ver logs cron
tail -f /tmp/auto_nav.log
```

Configuración de secciones (prefijos → grupos L1/L2 con iconos): editar el `SECTIONS` en `scripts/auto_nav.py` y re-deploy.

### Deploy del script

```bash
scp -i $SSH_KEY_PATH scripts/auto_nav.py ubuntu@$SERVER_IP:/tmp/auto_nav.py
ssh -i $SSH_KEY_PATH ubuntu@$SERVER_IP 'sudo mv /tmp/auto_nav.py /usr/local/bin/auto_nav.py && sudo chmod +x /usr/local/bin/auto_nav.py'
```

### Acordeón del sidebar

El mecanismo `wk-*` (headers colapsables, chevrons, botón "cerrar todo", highlight de página activa) se inyecta via `scripts/create_nav_accordion.py`. Si el acordeón se pierde (inject wipe / rollback), re-correr:

```bash
scp -i $SSH_KEY_PATH scripts/create_nav_accordion.py ubuntu@$SERVER_IP:/tmp/
ssh -i $SSH_KEY_PATH ubuntu@$SERVER_IP 'python3 /tmp/create_nav_accordion.py'
```

## Theming

CSS y JS viven en el campo `theming.injectCSS` / `injectHead` de la tabla `settings`. El archivo `theme/custom.css` es la fuente de verdad; el archivo en DB es la copia desplegada.

### Aplicar CSS actualizado

Paso 1 — desde el laptop:
```bash
scp -i $SSH_KEY_PATH theme/custom.css ubuntu@$SERVER_IP:/tmp/custom.css
```

Paso 2 — SSH al servidor y ejecutar:
```bash
docker cp /tmp/custom.css wiki-db:/tmp/theme.css
docker exec -i wiki-db psql -U wikijs -d wiki <<< $'\\set css `cat /tmp/theme.css`\nUPDATE settings SET value = jsonb_set(value::jsonb, \'{injectCSS}\', to_jsonb(:\'css\'::text))::json WHERE key=\'theming\';'
docker restart wiki
```

### Aplicar inject-head (favicon + accordion-v4)

Laptop:
```bash
scp -i $SSH_KEY_PATH theme/inject-head.html ubuntu@$SERVER_IP:/tmp/inject-head.html
```

Servidor:
```bash
docker cp /tmp/inject-head.html wiki-db:/tmp/inject-head.html
docker exec -i wiki-db psql -U wikijs -d wiki <<< $'\\set head `cat /tmp/inject-head.html`\nUPDATE settings SET value = jsonb_set(value::jsonb, \'{injectHead}\', to_jsonb(:\'head\'::text))::json WHERE key=\'theming\';'
docker restart wiki
```

### Rollback de emergencia (pantalla blanca)

Si un cambio de CSS/JS rompe el render, vaciar ambos campos y reconstruir:

```bash
docker exec wiki-db psql -U wikijs -d wiki -c "UPDATE settings SET value = jsonb_set(jsonb_set(value::jsonb, '{injectCSS}', '\"\"'::jsonb), '{injectHead}', '\"\"'::jsonb)::json WHERE key='theming';"
docker restart wiki
```

Luego re-aplicar CSS e inject-head con los comandos anteriores.

## Git Sync (backup del contenido del wiki)

El contenido del wiki se sincroniza bidireccionalmente con un repo privado en GitHub (rama `main`, intervalo 10 min por defecto).

| Parámetro | Valor |
|---|---|
| Repo | `git@github.com:nicoveraz/urgpedia-caspm-content.git` (privado) |
| Auth | SSH deploy key con write access (ID `149191083`) |
| Llave privada (servidor) | `/srv/wiki-git/id_ed25519` |
| Modo | Sync (bidireccional) |

**Agregar git-sync para otra clínica**: crear repo `urgpedia-<slug>-content`, generar keypair en `/srv/wiki-git/id_ed25519-<slug>`, añadir pubkey como deploy key con write, configurar Wiki.js admin → Storage → Git.

## Roles de usuario

| Rol | Permisos |
|---|---|
| `admin` | Gestión completa del sistema |
| `editor` | Crear y editar contenido |
| `viewer` | Solo lectura |

## Agregar una nueva clínica a la red

1. **Servidor**: nuevo stack Docker (wiki + wiki-db) en puerto distinto.
2. **Caddy**: agregar bloque `nueva-clinica.urgpedia.cl` en `/etc/caddy/Caddyfile`.
3. **Auth0**: agregar `https://nueva-clinica.urgpedia.cl/login/<AUTH0_STRATEGY_UUID>/callback` en Allowed Callback URLs.
4. **Landing**: copiar bloque `.card` en `landing/index.html`, activar y actualizar datos.
5. **Git sync**: crear repo `urgpedia-<slug>-content` + deploy key (ver sección Git Sync).
6. **Auto-nav**: desplegar `auto_nav.py` con `SECTIONS` adaptado, agregar cron.

Ver [docs/ESTADO-ACTUAL.md](docs/ESTADO-ACTUAL.md) para el estado técnico completo.

## Despliegue en producción

Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para instrucciones detalladas.

## Seguridad

- Variables sensibles en `.env` (no commitear).
- `.env.local` con IP y ruta de llave SSH (no commitear).
- Scripts con PII de usuarios están en `.gitignore` (`scripts/create-users-auth0.py`, `*-users-*.py`, `*.csv`).
- GraphQL introspection deshabilitado en producción.
- Firewall Oracle Cloud: solo puertos 22, 80, 443 abiertos.
- PostgreSQL no expuesto externamente (solo red interna Docker).

## Licencia

Uso interno — Red Andes Salud · Chile
