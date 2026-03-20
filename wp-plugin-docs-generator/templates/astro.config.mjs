import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Plugin Name',
      defaultLocale: 'es',
      locales: {
        es: { label: 'Español' },
      },
      expressiveCode: {
        themes: ['starlight-light'],
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Inicio',
          items: [
            { label: 'Overview', slug: '' },
            { label: 'Instalación', slug: 'installation' },
          ],
        },
        {
          label: 'Configuración',
          autogenerate: { directory: 'configuration' },
        },
        {
          label: 'Uso',
          autogenerate: { directory: 'usage' },
        },
        {
          label: 'Desarrolladores',
          autogenerate: { directory: 'developers' },
        },
        {
          label: 'Changelog',
          items: [
            { label: 'Historial', slug: 'changelog' },
          ],
        },
      ],
      components: {
        Head: './src/components/Head.astro',
      },
      social: {
        github: 'https://github.com/your-org/plugin-name',
      },
    }),
  ],
});
