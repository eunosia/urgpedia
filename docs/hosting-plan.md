# Plan de hosting — sitio URGpedia (Starlight)

Datos de plan/comportamiento verificados el 2026-05-31. Reverificar antes de
ejecutar.

---

## 1. Estado actual

Wiki.js (aplicación **dinámica, con base de datos**) sobre **Oracle Cloud Free
Tier** (Ubuntu). La migración lo reemplaza por un sitio **estático** (Starlight)
servido tras autenticación.

---

## 2. Requisito duro: el sitio va TRAS autenticación

El contenido es interno (médicos). Todo el sitio debe quedar detrás del gate de
lectores (ver `docs/auth-plan.md`).

### GitHub Pages queda DESCARTADO

En el tier gratuito, el contenido de GitHub Pages es **irreduciblemente
público**: la URL `usuario.github.io/repo` no pasa por ningún gate, aunque se
haga proxy del dominio custom por Cloudflare. El control de acceso nativo de
Pages es de **GitHub Enterprise**, no del tier gratuito. Por eso **no es una
opción viable** y solo se menciona aquí como descartada.

---

## 3. Solución: Cloudflare Pages + Cloudflare Access (ambos free)

### 3.1 Build / deploy

- El sitio Starlight se construye y despliega desde **este repo** (el del sitio)
  en **Cloudflare Pages**.
- Comando de build del proyecto: `npm run content:sync && npm run build`.
  El `content:sync` trae el contenido privado; ver §6 sobre credenciales.
- Directorio de salida: `dist/`.

### 3.2 Gate con Access sobre el dominio custom

- Aplicación de Access sobre `caspm.urgpedia.cl`, con **política Allow** que
  referencia el grupo **"URGpedia – médicos autorizados"** (ver `auth-plan.md`).

### 3.3 CRÍTICO — cerrar también las URL `*.pages.dev`

Por defecto, la política de Access en Pages protege los **subdominios de
preview**, pero deja **accesible** la URL de **producción**
`<proyecto>.pages.dev`. Eso es una fuga equivalente a la de GitHub Pages: el
sitio quedaría público por esa URL aunque el dominio custom esté gateado.

**Solución robusta (paso obligatorio, no opcional):** activar a nivel de
**cuenta** el ajuste **"Require Access protection"** (deny-by-default): bloquea
el tráfico a **cualquier hostname que no tenga una aplicación de Access**,
incluida la `*.pages.dev` de producción.

- Antes de activarlo: verificar que **todos** los hostnames públicos legítimos
  ya tienen una aplicación de Access con política Allow o Bypass, para no
  bloquear tráfico válido.
- Se pueden **exceptuar** hostnames puntuales si hiciera falta.

> Este ajuste es de cuenta y afecta a todos los hostnames; coordinar si la
> cuenta aloja otros proyectos.

---

## 4. Fallback: self-host estático en Oracle

Servir `dist/` como estático en la instancia Oracle existente, detrás de
**nginx + oauth2-proxy/Auth0** (ver `auth-plan.md` §5). Reusa infraestructura
propia, pero es **más operación**: servidor, nginx, certificados y proxy a
mantener. Útil solo si se quiere todo en infraestructura propia.

---

## 5. Modelo de publicación

- El contenido se trae por **fetch desde `main`** del repo de contenido en cada
  build. **Sin submódulo. Sin rama `published`.**
- El **merge de un PR revisado** en el repo de contenido (acto del mantenedor,
  que es la compuerta de revisión clínica) **es el acto de publicar**.
- Para un cambio de práctica que requiera anticipación, el mantenedor **retiene
  el merge** y avisa antes; el PR sin mergear funciona como **staging**.
- El **build corre en el host** (Cloudflare Pages), no a mano: el mantenedor no
  ejecuta builds manualmente.

---

## 6. CRÍTICO — rebuild cross-repo (contenido → sitio)

El contenido y el sitio están en repos distintos. Al **mergear a `main` en el
repo de CONTENIDO**, debe dispararse automáticamente el **deploy del sitio**:

- **Opción A**: un GitHub Action en el repo de contenido que, en `push` a
  `main`, llame al **Deploy Hook** (build hook) de Cloudflare Pages.
- **Opción B**: el Action emite un `repository_dispatch` hacia el repo del
  sitio, que a su vez gatilla el deploy.

En ambos casos el rebuild es **automático**: publicar = mergear.

### Credenciales para el contenido privado

El repo de contenido es privado; `content:sync` necesita lectura. En el build de
Cloudflare Pages, inyectar un **token de solo lectura** (p. ej. PAT de grano
fino con acceso de lectura al repo de contenido) como variable de entorno, y que
`content-sync.sh` lo use en la URL de clonado (`CONTENT_REPO`). No commitear el
token. (Configurar al ejecutar; aquí solo se documenta.)

---

## 7. Aviso al equipo al publicar

Al publicar, un Action envía un mensaje al **canal del equipo**
(WhatsApp / correo) vía **webhook**, complementado por el **changelog del sitio**
(blog de Novedades) como **registro permanente**. Se **documenta**, no se
implementa en esta tarea.

---

## 8. Secuencia de corte (cutover)

1. Correr Starlight **en paralelo** a Wiki.js.
2. **Validar paridad** (contenido, enlaces, búsqueda, sidebar, calculadoras).
3. Migrar **DNS** al sitio gateado (Cloudflare Pages + Access).
4. **Retirar Wiki.js** solo tras confirmar paridad.

---

## Fuentes (verificar vigencia)

- Require Access protection (deny-by-default): https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/require-access-protection/
- Changelog deny-by-default para zonas (2026-01-22): https://developers.cloudflare.com/changelog/post/2026-01-22-deny-by-default-for-zones/
- Proteger Pages con Access: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/secure-with-access/
