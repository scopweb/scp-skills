import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'MCP Server Name',
      // Force light-only code blocks
      expressiveCode: {
        themes: ['starlight-light'],
      },
      // Custom CSS for fonts and light theme
      customCss: ['./src/styles/custom.css'],
      // Sidebar navigation — adapt to the actual MCP server
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Overview', slug: '' },
            { label: 'Installation', slug: 'installation' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Usage & Tools', slug: 'usage' },
          ],
        },
        {
          label: 'Safety',
          items: [
            { label: 'Security', slug: 'security' },
          ],
        },
      ],
      // Override Head to inject Typekit fonts
      components: {
        Head: './src/components/Head.astro',
      },
      // Social links — adapt to the MCP repo
      social: {
        github: 'https://github.com/your-org/mcp-server-name',
      },
    }),
  ],
});
