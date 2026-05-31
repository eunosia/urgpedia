# Plan de autenticación — lectores de URGpedia

> Alcance: control de acceso de **lectores** (médicos y residentes) al sitio.
> La autenticación de **editores** es un asunto distinto y se documenta aparte
> en `docs/keystatic-opcional.md`. No mezclar ambas.

Datos de plan/precio verificados el 2026-05-31. Reverificar antes de ejecutar.

---

## 1. Solución: Cloudflare Access (Zero Trust)

El sitio es estático y no tiene autenticación propia. Se protege con
**Cloudflare Access**, que aplica el control en el *edge* de Cloudflare, antes
de que el request llegue al sitio. No requiere servidor ni código en la app.

- **Plan gratuito**: hasta **50 usuarios** sin costo (tier permanente, no prueba).
- Si se superan los 50 usuarios: plan de pago **USD 7 / usuario / mes** para
  todos los usuarios (sin facturación parcial). Para el tamaño esperado del
  equipo, el tier gratuito alcanza.

---

## 2. Método de login: PIN de un solo uso por correo (OTP)

Se usa el **One-time PIN (OTP)** incorporado en Access. **No** requiere
proveedor de identidad externo, **no** hay contraseñas y la mantención es
mínima.

**Flujo:**

1. El usuario abre `caspm.urgpedia.cl`.
2. Cloudflare Access **intercepta el request en el edge** (el sitio aún no se
   sirve).
3. Access pide el **correo** del usuario.
4. Access envía un **código de un solo uso** a ese correo (expira a los ~10
   minutos; verificar).
5. El usuario ingresa el código. Access lo deja pasar **solo si el correo está
   en la lista de autorizados**; si no, lo rechaza.

Se puede tener OTP y un IdP en paralelo, pero aquí OTP solo es suficiente y es
lo de menor mantención.

---

## 3. Autorización: lista explícita de correos (grupo reutilizable)

Los médicos **no tienen correo institucional**, así que **no** se puede usar una
regla por dominio (p. ej. "cualquiera @clinica.cl"). Se autoriza por **lista
explícita de correos personales**.

Para no repetir la lista en cada política, se gestiona como un **grupo
reutilizable de Access**:

- Crear un grupo de Access llamado **"URGpedia – médicos autorizados"** con la
  lista de correos personales.
- La **política Allow** de la aplicación referencia ese grupo (`Include →
  Access Group`). Altas y bajas se hacen en un solo lugar.

### Costo de proceso (importante)

- La lista es **manual**: cada alta/baja se administra a mano.
- Un **correo personal no se revoca solo** al salir la persona del equipo (a
  diferencia de un correo institucional, que TI desactiva al egreso). El acceso
  persiste hasta que alguien lo quite de la lista.
- **Control recomendado**: revisión periódica del grupo (p. ej. trimestral)
  como control de bajas. Documentar responsable y cadencia.

---

## 4. Separación lectores vs editores

| | Lectores | Editores |
|---|---|---|
| Qué protege | Acceso de lectura al sitio | Edición del contenido |
| Mecanismo | Cloudflare Access + OTP (este doc) | Keystatic Cloud (`keystatic-opcional.md`) |
| Identidad | Correo personal en grupo Access | Auth de Keystatic Cloud / GitHub App |

Son gates independientes. Este documento cubre **solo lectores**.

---

## 5. Fallback (no recomendado): oauth2-proxy + Auth0

Alternativa si se quisiera todo en infraestructura propia en vez de en el edge
de Cloudflare:

- **oauth2-proxy** delante de un origen self-hosted (la instancia Oracle),
  validando contra **Auth0** (el IdP que ya existe hoy).
- **Por qué es más operación**: requiere mantener un **servidor**, un
  **nginx** (u otro reverse proxy), **certificados** TLS y el propio **proxy**
  como pieza adicional. Cualquiera de esos componentes es superficie de fallo y
  de actualización.
- En cambio, Cloudflare Access **aplica el control en el edge, sin servidor**:
  no hay proxy propio que mantener ni certificados que renovar.

Se documenta como salida de contingencia, no como recomendación.

---

## Fuentes (verificar vigencia)

- Cloudflare Zero Trust — planes y precios: https://www.cloudflare.com/plans/zero-trust-services/
- One-time PIN login: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- Límites de cuenta: https://developers.cloudflare.com/cloudflare-one/account-limits/
