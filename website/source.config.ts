import { defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

export const docs = defineDocs({
  dir: '../docs',
  docs: {
    files: ['*.md'],
    schema: ({ source }) => pageSchema.extend({
      title: pageSchema.shape.title.default(source.match(/^# (.+)$/m)?.[1] ?? 'Codeboard'),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});
