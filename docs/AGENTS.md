# docs/AGENTS.md

Documentation website for dora CLI at https://dora-cli.dev. Built with Astro, deployed to Cloudflare Workers.

**For dora CLI context, commands, and schema, see `../AGENTS.md`.**

## Stack

- Framework: Astro 5.x
- Styling: Tailwind CSS 4.x via `@tailwindcss/vite`
- Icons: lucide-astro
- Deployment: Cloudflare Workers via `@astrojs/cloudflare`

## Structure

```
src/
├── pages/
│   ├── index.astro        # Landing page
│   ├── docs.astro         # Full documentation
│   ├── commands.astro     # Command reference
│   └── og-image.astro     # OG image (SSR)
├── components/            # Shared components
└── layouts/
    └── Layout.astro       # Base layout, nav, footer
```

## Dev

```bash
bun run dev      # http://localhost:4321
bun run build    # production build → dist/
bun run deploy   # deploy to Cloudflare Workers
```

## Keeping content in sync

When adding or changing dora CLI commands, update `commands.astro` to match. The command reference should mirror what `dora --help` outputs.

## Styling

Dark theme: `zinc-950` page background, `zinc-900` cards, `zinc-800` borders. Primary: `blue-400/500`. Body text: `zinc-300`.
