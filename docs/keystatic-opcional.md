# Editor visual opcional — Keystatic Cloud (a futuro)

> **Documentado, no instalado.** Esta tarea no configura Keystatic. Aquí se deja
> el plan para añadirlo más adelante como editor de **contenido**.
>
> Esto es autenticación de **editores**, distinta de la de lectores
> (`docs/auth-plan.md`). No mezclar.

Datos verificados el 2026-05-31. Reverificar antes de ejecutar.

---

## 1. Para qué

Dar a los autores (médicos) un **editor visual** del contenido **sin que cada
uno necesite cuenta de GitHub**. Keystatic guarda el contenido como Markdown en
el repo (no hay base de datos): encaja con el modelo git-native del proyecto.

- **Keystatic es open source y gratuito.**
- **Keystatic Cloud (tier gratuito):** proyectos y equipos ilimitados, hasta
  **3 usuarios por equipo**, con la autenticación de GitHub **gestionada por
  Keystatic** (los editores no usan su propia cuenta de GitHub). Si se necesitan
  más de 3 editores, reevaluar el plan.

---

## 2. Apunta al repo de CONTENIDO (no al del sitio)

Keystatic debe editar el repo **`urgpedia-caspm-content`** (la fuente de
verdad), no el repo del sitio. El flujo de publicación no cambia: editar →
abrir PR → revisión del mantenedor → merge a `main` → rebuild del sitio.

---

## 3. Compuerta de revisión clínica con `branchPrefix` + branch protection

El punto clave para preservar la **compuerta de revisión clínica**:

- **`branchPrefix`**: limita Keystatic a ramas con un prefijo (p. ej.
  `keystatic/`). En el Admin UI solo lista y crea ramas con ese prefijo; **nunca
  escribe directo en `main`**. Cada edición se vuelve una rama → un PR.
- **Branch protection sobre `main`** del repo de contenido: exige PR con
  revisión antes de mergear. Así, el editor propone cambios, pero **solo el
  mantenedor mergea** (la compuerta). El merge sigue siendo el acto de publicar.

Esquema de configuración (referencia, `keystatic.config.ts`):

```ts
import { config } from '@keystatic/core';

export default config({
  storage: {
    kind: 'cloud',
    // Repo de CONTENIDO, no el del sitio.
    repo: 'eunosia/urgpedia-caspm-content', // verificar owner/nombre
    branchPrefix: 'keystatic/',             // nunca escribe en main directo
  },
  cloud: { project: 'urgpedia/contenido' }, // verificar slug del proyecto cloud
  collections: {
    // definir colecciones que mapeen a las carpetas de protocolos
  },
});
```

> Owner/nombre del repo y slug del proyecto cloud: **verificar** al configurar.

---

## 4. Dónde corre el Admin UI

Keystatic se sirve como una pequeña app de administración (Astro o Next),
separada del sitio público de lectura. Puede desplegarse aparte y quedar, a su
vez, tras su propio control de acceso. Definir al momento de instalar.

---

## 5. Por qué encaja con este proyecto

- Contenido en Markdown en el repo → **git sigue siendo la fuente de verdad**.
- Editores **sin cuenta de GitHub** (Keystatic Cloud gestiona la auth).
- `branchPrefix` + branch protection → **la revisión clínica se mantiene** como
  compuerta de publicación.

---

## Fuentes (verificar vigencia)

- Keystatic Cloud: https://keystatic.com/docs/cloud
- GitHub mode / branchPrefix: https://keystatic.com/docs/github-mode
- Configuración: https://keystatic.com/docs/configuration
