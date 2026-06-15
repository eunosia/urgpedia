#!/usr/bin/env node
/**
 * mirror-content.mjs — Espeja el contenido clonado hacia src/content/docs/,
 * reemplazo portable de `rsync -a --delete --exclude ...`.
 *
 * Motivo: la imagen de build de Cloudflare Pages no trae `rsync`. Node sí está
 * disponible (es un build de Node), así que el copiado se hace aquí.
 *
 * Comportamiento equivalente al rsync que reemplaza:
 *  1. CLEAN: borra de DEST el contenido sincronizado previo, PERO conserva el
 *     andamiaje versionado del sitio (index.mdx, temas.mdx, los .gitkeep y el
 *     árbol blog/).
 *  2. COPY: copia desde SRC todo salvo la meta del repo de contenido (.git,
 *     README.md, intro-test.md, *.html, docs/, scripts/, .github/, CODEOWNERS)
 *     y los nombres de andamiaje (index.mdx, temas.mdx, .gitkeep, blog/).
 *
 * La normalización del frontmatter la hace después scripts/normalize-content.mjs.
 *
 * Uso: node scripts/mirror-content.mjs <SRC> <DEST>
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';

const SRC = process.argv[2];
const DEST = process.argv[3];

if (!SRC || !DEST) {
	console.error('[mirror] uso: node scripts/mirror-content.mjs <SRC> <DEST>');
	process.exit(1);
}

// Meta del repo de contenido que NO se copia (coincide por nombre en cualquier
// nivel, igual que los --exclude del rsync anterior).
const SKIP_NAMES = new Set([
	'.git',
	'README.md',
	'intro-test.md',
	'CODEOWNERS',
	'docs',
	'scripts',
	'.github',
	// nombres de andamiaje del sitio: no vienen del contenido y se preservan.
	'index.mdx',
	'temas.mdx',
	'.gitkeep',
	'blog',
]);
const SKIP_EXT = new Set(['.html']);

// Andamiaje en DEST que la fase CLEAN nunca borra.
const PRESERVE_FILES = new Set(['index.mdx', 'temas.mdx', '.gitkeep']);
const PRESERVE_DIRS = new Set(['blog']);

function shouldSkipSource(name) {
	return SKIP_NAMES.has(name) || SKIP_EXT.has(extname(name));
}

// 1. CLEAN: vacía el contenido sincronizado de DEST, conservando el andamiaje.
function clean(dir) {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			if (PRESERVE_DIRS.has(name)) continue;
			clean(full);
			if (readdirSync(full).length === 0) rmSync(full, { recursive: true });
		} else if (!PRESERVE_FILES.has(name)) {
			rmSync(full);
		}
	}
}

// 2. COPY: copia el contenido desde SRC, saltando la meta del repo.
let copied = 0;
function copy(dir) {
	for (const name of readdirSync(dir)) {
		if (shouldSkipSource(name)) continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			copy(full);
		} else {
			const dest = join(DEST, relative(SRC, full));
			mkdirSync(dirname(dest), { recursive: true });
			copyFileSync(full, dest);
			copied++;
		}
	}
}

mkdirSync(DEST, { recursive: true });
clean(DEST);
copy(SRC);
console.log(`[mirror] ${copied} archivos copiados a ${DEST}`);
