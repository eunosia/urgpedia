# Despliegue del sitio Starlight

Checklist para poner en producción el sitio Astro Starlight que reemplaza a
Wiki.js. La implementación heredada de Wiki.js (Oracle + Auth0 + Caddy) fue
retirada del repo y queda preservada en la etiqueta git `wikijs-legacy`.

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

## 2. Proyecto de build en Cloudflare · [tú]

> **Nota.** Este sitio se desplegó como **Worker con assets estáticos** (build
> conectado a Git + `wrangler deploy`, configurado por `wrangler.jsonc` en el
> repo). El build (clone del contenido, `npm run build`) es idéntico al de un
> proyecto Pages; lo que cambia es el deploy (sube `dist/` como assets) y la URL
> (`*.workers.dev`, ya desactivada). Los pasos siguientes aplican igual.

> **Rama de producción.** Tras el merge, `main` es el sitio Starlight (tiene
> `package.json` y `astro.config.mjs`), así que la **Production branch** del
> proyecto debe ser `main`. Si Pages quedó apuntando a otra rama o a un commit
> previo al merge sin `package.json`, el build falla con
> `npm error enoent ... package.json` (ver Troubleshooting).

1. Cloudflare Dashboard → **Workers & Pages** → Create → **Pages** → conectar a
   Git → repo `eunosia/urgpedia`.
   - **Production branch**: `main` (ya contiene el sitio Starlight).
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

## 4. Cerrar la URL pública `*.workers.dev` — OBLIGATORIO · [código, hecho]

Este proyecto se desplegó como **Worker con assets estáticos** (`wrangler.jsonc`,
`wrangler deploy`), no como Pages. Por defecto el Worker expone una URL pública
`<worker>.workers.dev` (aquí `urgpedia.urg.workers.dev`) + Preview URLs por
versión — fuga equivalente a la de `*.pages.dev`.

- **Resuelto en código**: `wrangler.jsonc` fija `workers_dev: false` y
  `preview_urls: false`, así el deploy no expone ninguna URL pública. El sitio
  solo se sirve por el dominio propio del paso 5, detrás de Access.
- Defensa en profundidad opcional (cuenta): **"Require Access protection"**
  (deny-by-default) bloquea cualquier hostname de tus zonas sin app de Access.
  Confirma antes que todo hostname legítimo tenga su app, para no cortar tráfico.

Referencia: `docs/hosting-plan.md` §3.3.

---

## 5. Dominio propio · [tú]

En el Worker `urgpedia` → **Settings → Domains & Routes** → **Add → Custom
domain** → `caspm.urgpedia.cl`. Cloudflare crea el registro DNS (la zona
`urgpedia.cl` debe estar en esta cuenta de Cloudflare). Con `workers.dev`
desactivado, este es el único acceso al sitio.

---

## 6. Rebuild automático al publicar (cross-repo) · [tú + código]

Publicar = mergear a `main` en el repo de **contenido**. Eso debe disparar el
build del **sitio** (que vive en otro repo). Workers Builds expone **Deploy
Hooks** (GA desde abril 2026): una URL que, al recibir un `POST`, lanza un build.

1. **Crear el Deploy Hook** (en el Worker del sitio): Workers & Pages → Worker
   `urgpedia` → **Settings → Builds → Deploy Hooks** → nombre + rama **`main`** →
   **Create** → copia la URL. Trátala como secreto (la URL es la credencial:
   cualquiera con ella puede disparar builds).
2. **Guardar el secret** en el repo **de contenido**: Settings → Secrets and
   variables → Actions → `CF_DEPLOY_HOOK` = la URL.
3. **Añadir el workflow** de ejemplo
   [`docs/examples/content-repo-deploy.yml`](examples/content-repo-deploy.yml)
   al repo de contenido en `.github/workflows/deploy-site.yml`. En cada `push` a
   `main` hace `POST` al hook y reconstruye el sitio (que trae el contenido
   fresco por `content:sync`).

> El workflow **vive en el repo de contenido**, no en este. Aquí se entrega como
> ejemplo para pegar/PR-ear allá. Workers Builds **deduplica** disparos en
> ráfaga y limita a 10 builds/min por Worker.

---

## 7. Cutover · [tú]

1. Corre Starlight **en paralelo** a Wiki.js.
2. **Valida paridad**: contenido, enlaces internos, búsqueda (Pagefind),
   sidebar, calculadoras embebidas.
3. Migra el **DNS** al sitio gateado.
4. **Retira Wiki.js** solo tras confirmar paridad.

---

## Troubleshooting

- **`npm error enoent ... /opt/buildhome/repo/package.json`** — Pages está
  construyendo una rama o commit sin el proyecto Astro (p. ej. un commit de
  `main` previo al merge de la migración). Asegura que la **Production branch**
  sea `main` ya con la migración mergeada (Settings → Builds & deployments) y
  re-despliega.
- **El build no encuentra el contenido / 0 protocolos** — falta `CONTENT_TOKEN`
  o no tiene permiso de lectura sobre el repo de contenido. Revisa la variable
  de entorno del proyecto (paso 2.3).

## Verificación final

- [x] Build de Cloudflare verde (trae contenido con `CONTENT_TOKEN`, 142 páginas).
- [x] Deploy verde (`wrangler deploy` sube `dist/` como assets estáticos).
- [x] URL pública `*.workers.dev` desactivada (`wrangler.jsonc`).
- [ ] `caspm.urgpedia.cl` agregado como dominio propio del Worker.
- [ ] `caspm.urgpedia.cl` pide login (Access OTP) y luego muestra el sitio.
- [ ] Merge a `main` del repo de contenido dispara un nuevo deploy.
- [ ] Paridad con Wiki.js validada antes de migrar el DNS.
