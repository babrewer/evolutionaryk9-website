import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import siteData from './src/data/site.json';

export default defineConfig({
  site: siteData.site.url,
  integrations: [sitemap()],
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
});
