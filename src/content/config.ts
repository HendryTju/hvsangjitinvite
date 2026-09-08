import { z, defineCollection } from "astro:content";

const siteConfigCollection = defineCollection({
  type: "data",
  schema: z.object({
    site: z.object({
      title: z.string(),
      description: z.string(),
    }),
    layout: z.object({
      showHero: z.boolean().default(true),
      showFeatures: z.boolean().default(true),
      showTestimonials: z.boolean().default(false),
      showContact: z.boolean().default(true),
    }),
    copy: z.object({
      hero: z.object({
        headline: z.string(),
        subheadline: z.string(),
        ctaText: z.string(),
      }),
    }),
  }),
});

export const collections = {
  config: siteConfigCollection,
};
