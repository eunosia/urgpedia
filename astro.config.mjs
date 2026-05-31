// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	// Dominio de producción (gateado tras Cloudflare Access). Necesario para
	// el sitemap y las URL absolutas. Ajustar si cambia el dominio.
	site: 'https://caspm.urgpedia.cl',
	integrations: [
		starlight({
			title: 'URGpedia',
			// Español como único idioma actual, pero con estructura de "locale
			// raíz": las URL quedan limpias (sin prefijo /es/) y agregar otro
			// idioma luego es solo añadir una entrada a `locales`.
			defaultLocale: 'root',
			locales: {
				root: { label: 'Español', lang: 'es' },
			},
			// La búsqueda usa Pagefind (incluido por defecto en Starlight); el
			// índice se genera en cada build.
			//
			// Sidebar agrupado por las secciones §N del manual. Cada grupo se
			// autogenera leyendo su carpeta en `src/content/docs/`; el orden
			// dentro de cada grupo se controla con `sidebar.order` en el
			// frontmatter de cada página (ver MIGRATION.md).
			sidebar: [
				{ label: 'Introducción', collapsed: true, items: [{ autogenerate: { directory: 'introduccion' } }] },
				{ label: 'El Servicio', collapsed: true, items: [{ autogenerate: { directory: 'el-servicio' } }] },
				{ label: 'Interconsultores', collapsed: true, items: [{ autogenerate: { directory: 'interconsultores' } }] },
				{ label: 'Servicios de Apoyo', collapsed: true, items: [{ autogenerate: { directory: 'servicios-de-apoyo' } }] },
				{ label: 'Marco Legal', collapsed: true, items: [{ autogenerate: { directory: 'marco-legal' } }] },
				{ label: 'Protocolos Operativos', collapsed: true, items: [{ autogenerate: { directory: 'protocolos-operativos' } }] },
				{ label: 'Protocolos de Calidad', collapsed: true, items: [{ autogenerate: { directory: 'protocolos-calidad' } }] },
				{ label: 'Protocolos Clínicos', collapsed: true, items: [{ autogenerate: { directory: 'protocolos-clinicos' } }] },
				{ label: 'Calculadoras', collapsed: true, items: [{ autogenerate: { directory: 'calculadoras' } }] },
			],
		}),
	],
});
