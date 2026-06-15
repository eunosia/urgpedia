#!/usr/bin/env bash
#
# content-sync.sh — Trae el contenido de los protocolos a src/content/docs/.
#
# Modelo de publicación (fijo): el contenido vive en un repositorio aparte
# (la fuente de verdad). Aquí se TRAE por fetch desde su rama `main` en cada
# build y también en desarrollo local. NO se usa submódulo de git. NO hay rama
# `published`. El merge de un PR revisado en el repo de contenido (acto del
# mantenedor, que es la compuerta de revisión clínica) es el acto de publicar.
#
# El contenido sincronizado NO se versiona en el repo del sitio (está en
# .gitignore). Un clon en frío del sitio solo trae el andamiaje (portada
# provisional y secciones vacías); el contenido real aparece tras correr este
# script.
#
# Variables de entorno (con valores por defecto):
#   CONTENT_REPO    URL del repo de contenido (privado; el build necesita
#                   credenciales de lectura). Por defecto eunosia/urgpedia-caspm-content.
#   CONTENT_BRANCH  Rama a traer (por defecto: main).
#   CONTENT_SUBDIR  Subcarpeta del repo de contenido que contiene los .md
#                   (por defecto: ".", la raíz). Ajustar si el contenido vive
#                   en una subcarpeta (p. ej. "content" o "es").
#   CONTENT_TOKEN   (Opcional) Token de SOLO LECTURA del repo de contenido
#                   privado (PAT fine-grained con Contents: Read). Necesario en
#                   CI/hosting, donde no hay credential helper. En local no hace
#                   falta si git ya autentica por keychain/gh. El token se pasa
#                   por header HTTP: NO se persiste en el .git del caché ni se
#                   imprime en los logs.
#
set -euo pipefail

CONTENT_REPO="${CONTENT_REPO:-https://github.com/eunosia/urgpedia-caspm-content.git}"
CONTENT_BRANCH="${CONTENT_BRANCH:-main}"
CONTENT_SUBDIR="${CONTENT_SUBDIR:-.}"

CACHE_DIR=".content-cache"
DEST="src/content/docs"

# Auth opcional para repo privado. Si hay CONTENT_TOKEN, se inyecta como header
# Authorization en cada operación de red (clone/fetch) sin guardarlo en disco.
# `${git_auth[@]+...}` evita el error de "unbound variable" con array vacío.
git_auth=()
if [ -n "${CONTENT_TOKEN:-}" ]; then
  token_b64=$(printf 'x-access-token:%s' "${CONTENT_TOKEN}" | base64 | tr -d '\n')
  git_auth=(-c "http.extraHeader=Authorization: Basic ${token_b64}")
  echo "[content:sync] usando CONTENT_TOKEN para autenticar (header)"
fi

echo "[content:sync] repo=${CONTENT_REPO} rama=${CONTENT_BRANCH} subdir=${CONTENT_SUBDIR}"

if [ -d "${CACHE_DIR}/.git" ]; then
  echo "[content:sync] actualizando caché existente"
  git ${git_auth[@]+"${git_auth[@]}"} -C "${CACHE_DIR}" fetch --depth 1 origin "${CONTENT_BRANCH}"
  git -C "${CACHE_DIR}" reset --hard "origin/${CONTENT_BRANCH}"
else
  echo "[content:sync] clonando contenido (shallow)"
  rm -rf "${CACHE_DIR}"
  git ${git_auth[@]+"${git_auth[@]}"} clone --depth 1 --branch "${CONTENT_BRANCH}" "${CONTENT_REPO}" "${CACHE_DIR}"
fi

mkdir -p "${DEST}"

# Espeja el contenido hacia DEST. --delete mantiene DEST igual a la fuente,
# pero se preservan los archivos de andamiaje versionados (portada e índices
# .gitkeep de secciones) y nunca se copia el .git del repo de contenido.
# Se excluyen también los archivos de meta del repo de contenido (README,
# scripts de validación, CI, páginas de prueba/HTML de Wiki.js) que no son
# protocolos publicables.
echo "[content:sync] copiando a ${DEST}"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'index.mdx' \
  --exclude 'temas.mdx' \
  --exclude '.gitkeep' \
  --exclude 'blog' \
  --exclude 'README.md' \
  --exclude 'intro-test.md' \
  --exclude '*.html' \
  --exclude 'docs' \
  --exclude 'scripts' \
  --exclude '.github' \
  --exclude 'CODEOWNERS' \
  "${CACHE_DIR}/${CONTENT_SUBDIR}/" "${DEST}/"

# Normaliza el frontmatter Wiki.js -> Starlight en el contenido ya copiado.
# El repo de contenido NO se modifica; la transformación ocurre solo aquí.
echo "[content:sync] normalizando frontmatter"
node scripts/normalize-content.mjs "${DEST}"

echo "[content:sync] listo"
