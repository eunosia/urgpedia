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
#   CONTENT_REPO    URL del repo de contenido. VERIFICAR la URL/credenciales
#                   reales antes de usar (el repo es privado).
#   CONTENT_BRANCH  Rama a traer (por defecto: main).
#   CONTENT_SUBDIR  Subcarpeta del repo de contenido que contiene los .md
#                   (por defecto: ".", la raíz). Ajustar si el contenido vive
#                   en una subcarpeta (p. ej. "content" o "es").
#
set -euo pipefail

CONTENT_REPO="${CONTENT_REPO:-https://github.com/eunosia/urgpedia-caspm-content.git}"
CONTENT_BRANCH="${CONTENT_BRANCH:-main}"
CONTENT_SUBDIR="${CONTENT_SUBDIR:-.}"

CACHE_DIR=".content-cache"
DEST="src/content/docs"

echo "[content:sync] repo=${CONTENT_REPO} rama=${CONTENT_BRANCH} subdir=${CONTENT_SUBDIR}"

if [ -d "${CACHE_DIR}/.git" ]; then
  echo "[content:sync] actualizando caché existente"
  git -C "${CACHE_DIR}" fetch --depth 1 origin "${CONTENT_BRANCH}"
  git -C "${CACHE_DIR}" reset --hard "origin/${CONTENT_BRANCH}"
else
  echo "[content:sync] clonando contenido (shallow)"
  rm -rf "${CACHE_DIR}"
  git clone --depth 1 --branch "${CONTENT_BRANCH}" "${CONTENT_REPO}" "${CACHE_DIR}"
fi

mkdir -p "${DEST}"

# Espeja el contenido hacia DEST. --delete mantiene DEST igual a la fuente,
# pero se preservan los archivos de andamiaje versionados (portada e índices
# .gitkeep de secciones) y nunca se copia el .git del repo de contenido.
echo "[content:sync] copiando a ${DEST}"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'index.mdx' \
  --exclude '.gitkeep' \
  "${CACHE_DIR}/${CONTENT_SUBDIR}/" "${DEST}/"

echo "[content:sync] listo"
