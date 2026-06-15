#!/usr/bin/env node
/**
 * normalize-content.mjs — Normaliza el frontmatter Wiki.js a frontmatter
 * Starlight, EN EL MOMENTO DEL SYNC (no se toca el repo de contenido).
 *
 * El repo de contenido (`urgpedia-caspm-content`) es un espejo bidireccional de
 * Wiki.js (Git Storage). Su frontmatter es de Wiki.js y NO es compatible con el
 * esquema de Starlight:
 *   - `tags` es un STRING separado por comas; Starlight espera un array.
 *   - trae campos propios de Wiki.js (`published`, `editor`, `date`,
 *     `dateCreated`) y bloques del RAG (`citas`, `dosis`, `calculadoras`) con
 *     fechas en formato no-ISO (espacio en vez de `T`) que rompen el parseo.
 *
 * Este script reescribe SOLO el frontmatter de cada `.md` ya copiado a
 * `src/content/docs/` dejando un set mínimo y válido para Starlight. El cuerpo
 * del documento queda intacto. Es idempotente.
 *
 * Mapeo:
 *   title       -> title (requerido; si falta, se deriva del nombre de archivo)
 *   description -> description (se re-emite entre comillas para evitar `:`)
 *   tags: "a,b" -> tags: [a, b] (vacío -> se omite)
 *   date|dateCreated -> lastUpdated (solo si parsea a fecha válida; ISO con Z)
 *   published, editor, dateCreated, citas, dosis, calculadoras -> se descartan
 *     (los bloques del RAG los consume `eunosia-rag`, no el sitio).
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const DEST = process.argv[2] ?? 'src/content/docs';

/** Lista de archivos que NO se normalizan (andamiaje versionado del sitio). */
const SKIP_NAMES = new Set(['index.mdx', 'temas.mdx']);

/** Comillas YAML para un escalar de una línea (doble-comillas, escapando). */
function yamlQuote(value) {
	return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** Título legible a partir del nombre de archivo, como último recurso. */
function titleFromFilename(file) {
	return basename(file, extname(file))
		.replace(/-/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Separa el primer bloque de frontmatter (--- ... ---) del cuerpo.
 * Devuelve { fm: string|null, body: string }.
 */
function splitFrontmatter(raw) {
	if (!raw.startsWith('---')) return { fm: null, body: raw };
	const lines = raw.split('\n');
	// lines[0] === '---'
	let end = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === '---') {
			end = i;
			break;
		}
	}
	if (end === -1) return { fm: null, body: raw };
	const fm = lines.slice(1, end).join('\n');
	const body = lines.slice(end + 1).join('\n');
	return { fm, body };
}

/**
 * Extrae los escalares de primer nivel del frontmatter Wiki.js. Ignora las
 * líneas indentadas (hijos de bloques como `citas`/`calculadoras`).
 */
function parseTopLevel(fm) {
	const out = {};
	if (!fm) return out;
	for (const line of fm.split('\n')) {
		if (/^\s/.test(line)) continue; // hijo indentado: ignorar
		const m = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
		if (!m) continue;
		out[m[1]] = m[2].trim();
	}
	return out;
}

function buildFrontmatter(fields, file) {
	const lines = ['---'];

	let title = fields.title ?? '';
	// Quita comillas envolventes que ya trajera Wiki.js.
	title = title.replace(/^["']|["']$/g, '').trim();
	if (!title) title = titleFromFilename(file);
	lines.push(`title: ${yamlQuote(title)}`);

	let description = (fields.description ?? '').replace(/^["']|["']$/g, '').trim();
	if (description) lines.push(`description: ${yamlQuote(description)}`);

	// tags: "a, b, c" -> array; vacío -> se omite.
	const rawTags = (fields.tags ?? '').replace(/^\[|\]$/g, '');
	const tags = rawTags
		.split(',')
		.map((t) => t.replace(/^["']|["']$/g, '').trim())
		.filter(Boolean);
	if (tags.length) {
		lines.push('tags:');
		for (const t of tags) lines.push(`  - ${yamlQuote(t)}`);
	}

	// lastUpdated desde date|dateCreated, solo si parsea a fecha válida.
	const rawDate = (fields.date ?? fields.dateCreated ?? '').replace(/^["']|["']$/g, '').trim();
	if (rawDate) {
		const d = new Date(rawDate.replace(' ', 'T'));
		if (!Number.isNaN(d.getTime())) lines.push(`lastUpdated: ${d.toISOString()}`);
	}

	lines.push('---');
	return lines.join('\n');
}

/** Carpetas de andamiaje del sitio (no son contenido Wiki.js). */
const SKIP_DIRS = new Set(['blog']);

function walk(dir) {
	const files = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			if (SKIP_DIRS.has(name)) continue;
			files.push(...walk(full));
		} else if (extname(full) === '.md' || extname(full) === '.mdx') files.push(full);
	}
	return files;
}

let normalized = 0;
let skipped = 0;
for (const file of walk(DEST)) {
	if (SKIP_NAMES.has(basename(file))) {
		skipped++;
		continue;
	}
	const raw = readFileSync(file, 'utf8');
	const { fm, body } = splitFrontmatter(raw);
	const fields = parseTopLevel(fm);
	const newFm = buildFrontmatter(fields, file);
	writeFileSync(file, newFm + '\n' + body.replace(/^\n/, ''));
	normalized++;
}

console.log(`[normalize] ${normalized} archivos normalizados, ${skipped} de andamiaje omitidos`);
