import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { blogSchema } from 'starlight-blog/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		// Se extiende el esquema de docs con el del blog (Novedades) para que las
		// entradas acepten date, tags, authors, etc.
		schema: docsSchema({ extend: (context) => blogSchema(context) }),
	}),
};
