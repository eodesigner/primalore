import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { categories, contentTypes, reviewStatuses } from './data/categories';

const source = z.object({
  title: z.string().min(3),
  url: z.string().url(),
  publisher: z.string().min(2),
  reliability: z.enum(['A', 'B', 'C']),
  accessed: z.coerce.date(),
});

const entries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content' }),
  schema: z.object({
    title: z.string().min(3),
    type: z.enum(contentTypes),
    category: z.enum(categories.map((c) => c.slug) as [string, ...string[]]),
    subtopic: z.string().min(2),
    level: z.number().int().min(1).max(4),
    risk: z.enum(['low', 'medium', 'high', 'critical']),
    region: z.string().min(2).default('global'),
    season: z.enum(['all', 'spring', 'summer', 'autumn', 'winter']).default('all'),
    language: z.literal('en-GB').default('en-GB'),
    summary: z.string().min(10),
    sources: z.array(source).min(1),
    reviewed_by: z.string().default(''),
    review_status: z.enum(reviewStatuses),
    published: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    related: z.array(z.string()).default([]),
  }),
});

export const collections = { entries };
