# Despliegue del sitio Starlight

Checklist para poner en producción el sitio Astro Starlight que reemplaza a
Wiki.js. La guía legacy de Wiki.js (Oracle + Auth0 + Caddy) vive en
`docs/DEPLOYMENT.md`; esta es la del sitio nuevo.

Estado del repo del sitio: el contenido real **compila** (`npm run content:sync
&& npm run build`). Lo que falta es **infraestructura** (hosting, auth, CI),
que requiere acceso a Cloudflare / GitHub / DNS. Cada paso marca **[tú]**
(acción en un servicio externo) o **[código]** (ya resuelto en este repo).

Planes de fondo: `docs/hosting-plan.md` y `docs/auth-plan.md`.

```
Wiki.js (autor clínico) ⇄ repo de contenido (main)
                              │  merge a main = publicar
                              ▼  (GitHub Action → Deploy Hook)
        Cloudflare Pages (build: content:sync + build → dist/)
                              │
                              ▼  tras Cloudflare Access (OTP por correo)
                        caspm.urgpedia.cl
```

---

## 1. Token de lectura del contenido privado · [tú]

El repo de contenido (`eunosia/urgpedia-caspm-content`) es **privado**. En local
el clone funciona con tu keychain/`gh`, pero **en CI no hay credencial**: el
build necesita un token.

1. GitHub → Settings → Developer settings → **Fine-grained tokens**.
2. Resource owner: `eunosia`. Repository access: solo
   `urgpedia-caspm-content`.
3. Permisos: **Contents: Read-only**. (Nada más.)
4. Genera el token y guárdalo; lo usarás como variable de entorno en el paso 2.

> **[código]** `scripts/content-sync.sh` ya soporta este token vía la variable
> `CONTENT_TOKEN`: lo inyecta como header `Authorization` en el clone/fetch, sin
> persistirlo en disco ni imprimirlo. Probado contra el repo privado real.

---

## 2. Cloudflare Pages · [tú]

1. Cloudflare Dashboard → **Workers & Pages** → Create → **Pages** → conectar a
   Git → repo `eunosia/urgpedia` → rama `feat/starlight-migration` (o `main`
   tras el merge).
2. Build settings:
   - **Framework preset**: Astro (o None).
   - **Build command**: `npm run content:sync && npm run build`
   - **Build output directory**: `dist`
3. **Environment variables** (Production y Preview):
   - `CONTENT_TOKEN` = el token del paso 1 (marcar como *secret* / *encrypt*).
4. Guarda y lanza el primer build. Debe traer los protocolos y publicar `dist/`.

---

## 3. Cloudflare Access — gate de lectura · [tú]

El contenido es interno; todo el sitio va tras login. Detalle en
`docs/auth-plan.md`.

1. Cloudflare **Zero Trust** → Access → **Applications** → Add → *Self-hosted*.
2. Application domain: `caspm.urgpedia.cl`.
3. Identity: **One-time PIN** (OTP por correo; no requiere IdP externo).
4. Crea un grupo "URGpedia – médicos autorizados" con la lista de correos
   permitidos y una política **Allow** que lo referencie.

---

## 4. Cerrar las URL `*.pages.dev` — OBLIGATORIO · [tú]

Access protege los previews pero deja **pública** la URL de producción
`<proyecto>.pages.dev`. Es una fuga equivalente a GitHub Pages.

- En la **cuenta** de Cloudflare, activa **"Require Access protection"**
  (deny-by-default): bloquea cualquier hostname sin app de Access, incluida la
  `*.pages.dev`.
- Antes de activarlo, confirma que todos los hostnames legítimos ya tienen su
  app de Access, para no cortar tráfico válido.
- Es un ajuste de cuenta: coordina si la cuenta aloja otros proyectos.

Referencia: `docs/hosting-plan.md` §3.3.

---

## 5. DNS · [tú]

En el proyecto de Pages → **Custom domains** → añade `caspm.urgpedia.cl` y sigue
la guía (registro CNAME/gestión en Cloudflare DNS).

---

## 6. Rebuild automático al publicar (cross-repo) · [tú + código]

Publicar = mergear a `main` en el repo de **contenido**. Eso debe disparar el
build del **sitio**:

1. En Cloudflare Pages → Settings → **Deploy hooks** → crea uno (te da una URL
   secreta). Cópiala.
2. En el repo **de contenido**, guarda esa URL como secret
   `CF_PAGES_DEPLOY_HOOK` (Settings → Secrets and variables → Actions).
3. Añade al repo de contenido el workflow de ejemplo
   [`docs/examples/content-repo-deploy.yml`](examples/content-repo-deploy.yml)
   en `.github/workflows/deploy-site.yml`. En cada `push` a `main` llama al
   deploy hook y reconstruye el sitio.

> El workflow **vive en el repo de contenido**, no en este. Aquí se entrega como
> ejemplo para pegar/PR-ear allá.

---

## 7. Cutover · [tú]

1. Corre Starlight **en paralelo** a Wiki.js.
2. **Valida paridad**: contenido, enlaces internos, búsqueda (Pagefind),
   sidebar, calculadoras embebidas.
3. Migra el **DNS** al sitio gateado.
4. **Retira Wiki.js** solo tras confirmar paridad.

---

## Verificación final

- [ ] Build de Cloudflare Pages verde (trae contenido con `CONTENT_TOKEN`).
- [ ] `caspm.urgpedia.cl` pide login (Access OTP) y luego muestra el sitio.
- [ ] `<proyecto>.pages.dev` **bloqueado** (Require Access protection activo).
- [ ] Merge a `main` del repo de contenido dispara un nuevo deploy.
- [ ] Paridad con Wiki.js validada antes de migrar el DNS.
