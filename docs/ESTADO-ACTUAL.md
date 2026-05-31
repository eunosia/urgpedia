# Estado Actual del Proyecto — urgpedia

> Referencia técnica para sesiones de desarrollo en Claude Code.
> Última actualización: 2026-03-07

---

## 1. Infraestructura

| Elemento | Valor |
|---|---|
| Servidor | Oracle Cloud · Ubuntu 22.04 |
| IP pública | Ver `.env.local` (no commitear) |
| SSH key | Ver `.env.local` (no commitear) |
| Reverse proxy | Caddy 2 · `/etc/caddy/Caddyfile` |
| SSL | Let's Encrypt automático vía Caddy |

> **Seguridad**: La IP del servidor y la ruta de la llave SSH están en `.env.local` (excluido de Git).
> Copiar de `.env.example` y completar con los valores reales.

**Contenedores Docker:**

| Contenedor | Imagen | Puerto | Descripción |
|---|---|---|---|
| `wiki` | requarks/wiki:2 | 3000 | Wiki.js |
| `wiki-db` | postgres:15 | — (interno) | PostgreSQL 15 |

---

## 2. Dominios y routing

**Caddyfile actual** (`/etc/caddy/Caddyfile`):

```caddy
(security-headers) {
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        -Server
    }
}

urgpedia.cl {
    import security-headers
    header Content-Security-Policy "default-src 'self'; style-src 'unsafe-inline' 'self'; img-src 'self' data:"
    root * /srv/urgpedia
    file_server
}

caspm.urgpedia.cl {
    import security-headers
    handle /assets/* {
        root * /srv/urgpedia
        file_server
    }
    @login path /login
    redir @login /login/81ff3df8-2a3f-4073-b335-38d113f6da22 302
    reverse_proxy localhost:3000
}
```

> **Nota sobre redirects**: redirigir `/login` (exact match) a Auth0, NO `/`. El callback `/login/81ff3df8-.../callback` no matchea `path /login` y pasa al reverse proxy. Post-login Wiki.js redirige a `/` y Caddy no lo intercepta → sin loop.
> Los assets se sirven desde `caspm.urgpedia.cl/assets/` (mismo origen que Wiki.js) para evitar el bloqueo por CSP `img-src 'self'` que impone Wiki.js.

| URL | Resultado |
|---|---|
| `urgpedia.cl` | Landing page estática desde `/srv/urgpedia/` |
| `urgpedia.cl/assets/*` | SVGs de branding (landing) |
| `caspm.urgpedia.cl/assets/*` | SVGs de branding (Wiki.js — mismo origen) |
| `caspm.urgpedia.cl/` | Wiki.js → Auto Login activo → redirige directo a Auth0 |
| `caspm.urgpedia.cl/*` | Wiki.js (reverse proxy a localhost:3000) |

> **Pendiente DNS**: agregar registro `A urgpedia.cl → $SERVER_IP` en el registrador de dominio (ver .env.local).

---

## 3. Autenticación — Auth0

| Parámetro | Valor |
|---|---|
| Tenant | `dev-0zpeshonra8ull1d.us.auth0.com` |
| Aplicación | Regular Web Application |
| Strategy UUID (Wiki.js) | `81ff3df8-2a3f-4073-b335-38d113f6da22` |
| Callback configurado | `https://caspm.urgpedia.cl/login/81ff3df8-2a3f-4073-b335-38d113f6da22/callback` |

**Para agregar una nueva clínica:**
Ir a Auth0 Dashboard → Applications → Allowed Callback URLs → agregar `https://nueva-clinica.urgpedia.cl/login/<AUTH0_STRATEGY_UUID>/callback`.

El SSO es transparente: un usuario autenticado en cualquier subdominio no necesita volver a hacer login en otro.

---

## 4. Wiki.js — archivos modificados en el contenedor

Los siguientes archivos dentro del contenedor `wiki` fueron modificados directamente:

### `/wiki/server/views/login.pug`
No agregar redirect JS automático al proveedor social. Si existe un override con
`window.location.replace('/login/<AUTH0_STRATEGY_UUID>')`, eliminarlo: combinado
con el callback social de Wiki.js y con redirects del proxy provoca loops.

### `/wiki/server/core/servers.js`
GraphQL introspection deshabilitado (seguridad):
```javascript
this.servers.graph = new ApolloServer({
  ...graphqlSchema,
  introspection: false,   // ← agregado
  context: ({ req, res }) => ({ req, res }),
  ...
})
```

**Advertencia**: los cambios en el contenedor se pierden si se recrea el contenedor. Considerar montar los archivos como volúmenes o hacer imagen custom.

---

## 5. Wiki.js — configuración en base de datos

Acceso: `docker exec wiki-db psql -U wikijs -d wiki`

### Auth settings
```sql
-- autoLogin: true (redirige directo a Auth0 sin mostrar pantalla de selección)
SELECT key, value FROM settings WHERE key = 'auth';
```

### Search engine
```sql
-- PostgreSQL full-text activo con diccionario español
SELECT key, "isEnabled", config FROM "searchEngines" WHERE "isEnabled" = true;
-- Resultado: postgres | true | {"dictLanguage":"spanish"}
```
> ⚠️ **Pendiente**: reconstruir índice de búsqueda.
> Admin → Search Engine → Rebuild Index

### Comments
```sql
SELECT key, "isEnabled" FROM "commentProviders" WHERE key = 'default';
-- Resultado: default | true
```

### Theming (logoUrl y favicon)
```sql
SELECT value->>'logoUrl', value->>'injectHead' FROM settings WHERE key = 'theming';
```
- `logoUrl`: `https://caspm.urgpedia.cl/assets/urgpedia-icon.svg` (mismo origen → evita bloqueo CSP)
- `injectHead`: script JS que reemplaza los `<link rel="icon">` por `https://caspm.urgpedia.cl/assets/urgpedia-favicon.svg`

---

## 6. Assets de marca

| Archivo | Uso | Fondo óptimo |
|---|---|---|
| `urgpedia-icon.svg` | Header Wiki.js · hero landing page | Azul `#04488e` / oscuro |
| `urgpedia-icon-blue.svg` | Nav landing page | Blanco / gris claro |
| `urgpedia-favicon.svg` | Favicon browser tab | Cualquiera (autónomo) |

**Diseño**: Material Design "cognition" icon (silueta de cabeza, espiral removida) + cruz médica knockout (transparente, toma el color del fondo).

Los assets se sirven localmente desde `/srv/urgpedia/assets/` en el servidor (no desde GitHub raw).

**Deploy de assets al servidor** (después de actualizar SVGs):
```bash
sudo mkdir -p /srv/urgpedia/assets
sudo cp assets/urgpedia-icon.svg /srv/urgpedia/assets/
sudo cp assets/urgpedia-icon-blue.svg /srv/urgpedia/assets/
sudo cp assets/urgpedia-favicon.svg /srv/urgpedia/assets/
```

---

## 7. Landing page

- **Repo**: `landing/index.html`
- **Servidor**: `/srv/urgpedia/index.html`
- **Tecnología**: HTML + CSS puro (sin frameworks, sin build step)
- **Íconos**: referencias a GitHub raw URLs de `assets/`

**Deploy al servidor** (copiar landing + assets):
```bash
sudo cp landing/index.html /srv/urgpedia/index.html
sudo mkdir -p /srv/urgpedia/assets
sudo cp assets/*.svg /srv/urgpedia/assets/
```

**Para agregar una nueva clínica en la landing:**
Copiar el bloque `.card.coming-soon`, eliminar la clase `coming-soon`, y actualizar:
- `href` → URL del nuevo subdominio
- `h3` → Nombre de la clínica
- `.card-location` → Ciudad, región
- `.card-desc` → Descripción
- `.badge` → cambiar a `badge-active` con texto "Activo"

---

## 7b. Git Sync — Wiki.js → GitHub

Wiki.js Git Storage module sincroniza el contenido del wiki (páginas, assets) con un repo privado en GitHub. Modo **sync** bidireccional (rama `main`, intervalo 10 min por defecto).

| Parámetro | Valor |
|---|---|
| Repo | `git@github.com:eunosia/urgpedia-caspm-content.git` (privado) |
| Rama | `main` |
| Modo | Sync (bidireccional) |
| Auth | SSH deploy key con write access (ID `149191083`) |
| Llave privada (servidor) | `/srv/wiki-git/id_ed25519` |
| Llave pública (deploy key) | `/srv/wiki-git/id_ed25519.pub` |
| Author email | `wiki-git-sync@caspm.urgpedia.cl` |
| Author name | `Wiki.js CASPM` |

**Riesgo de sync bidireccional**: si la misma página se edita en wiki y en git entre syncs, Wiki.js conserva el timestamp más reciente y sobrescribe el otro lado. Recomendación: editar siempre desde el wiki, tratar el repo como backup + lectura.

**Añadir una nueva clínica**:
1. Crear repo privado `urgpedia-<slug>-content` en GitHub.
2. Generar nuevo keypair en el servidor: `/srv/wiki-git/id_ed25519-<slug>`.
3. Añadir pubkey como deploy key (write) en el nuevo repo.
4. Configurar Wiki.js (de la nueva clínica) → Storage → Git con URL, rama, y el contenido de la llave privada.

**Restaurar contenido desde el repo** (si el wiki pierde datos):
Wiki.js admin → Storage → Git → **Import Everything**. Tira del repo y reescribe el contenido del wiki.

---

## 8. Seguridad

| Medida | Estado |
|---|---|
| GraphQL introspection | ✅ Deshabilitado |
| Firewall Oracle Cloud | ✅ Solo puertos 22, 80, 443 |
| PostgreSQL expuesto | ✅ No (solo acceso interno Docker) |
| PII en Git | ✅ Nunca commiteado (en `.gitignore`) |
| Auth0 SSO | ✅ Configurado |

**Archivos sensibles en `.gitignore`:**
```
scripts/create-users-auth0.py
scripts/*-users-*.py
*.csv
```

> `scripts/create-users-auth0.py` contiene nombres y emails de médicos (PII) y la contraseña temporal. **Nunca commitear**.

---

## 9. Tareas pendientes

- [ ] **DNS**: agregar registro `A urgpedia.cl → $SERVER_IP` en registrador de dominio (ver .env.local)
- [ ] **Search index**: Admin → Search Engine → Rebuild Index (tras cambio de `db` a `postgres`)
- [ ] **Wiki.js Auto Login**: confirmar que está activo y que no quedan redirects manuales en Caddy o `login.pug`
- [ ] **Nueva clínica**: nuevo stack Docker + subdominio en Caddy + callback Auth0 + card en landing
- [x] **Volúmenes Docker**: login.pug y servers.js montados como volúmenes en docker-compose.yml (ver `overrides/`)
- [x] **Git Sync**: Wiki.js → `urgpedia-caspm-content` (repo privado, SSH, modo sync, rama main)

---

## 10. Comandos frecuentes

```bash
# ── SERVIDOR ────────────────────────────────────────
ssh -i $SSH_KEY_PATH ubuntu@$SERVER_IP    # Valores en .env.local

# ── DOCKER ──────────────────────────────────────────
docker ps                          # Ver contenedores corriendo
docker logs wiki --tail 50         # Logs Wiki.js
docker restart wiki                # Reiniciar Wiki.js

# ── BASE DE DATOS ────────────────────────────────────
docker exec wiki-db psql -U wikijs -d wiki

# ── CADDY ───────────────────────────────────────────
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
cat /etc/caddy/Caddyfile

# ── LANDING PAGE ────────────────────────────────────
sudo cp landing/index.html /srv/urgpedia/index.html
sudo cp assets/*.svg /srv/urgpedia/assets/

# ── EDITAR ARCHIVOS EN CONTENEDOR ───────────────────
# (escribir primero en /tmp, luego docker cp)
docker cp /tmp/archivo.pug wiki:/wiki/server/views/archivo.pug
```

---

## 11. Historial de decisiones relevantes

| Decisión | Motivo |
|---|---|
| Auth0 en lugar de login local | SSO corporativo, gestión centralizada de usuarios |
| Redirect en Caddy (no solo JS) | Server-side, más rápido, no depende de JS |
| `@root path /` en Caddy | `redir /` usa prefijo y redirige todo; `path /` es exact match |
| PostgreSQL full-text search | Mejor calidad para contenido médico en español |
| SVG servidos localmente (no GitHub raw) | Independencia de GitHub; no falla si repo es privado |
| GraphQL introspection deshabilitado | Evita exposición del schema de la API |
| Archivos PII en `.gitignore` | `create-users-auth0.py` nunca fue commiteado (verificado) |
| Git Sync a repo privado | Backup externo del contenido + posibilidad de rollback vía git history |
