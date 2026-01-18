# docs/CLAUDE.md

This file provides guidance for maintaining and updating the dora CLI documentation website.

**Parent Context:** For dora CLI tool context, commands, and database schema, see `../CLAUDE.md` in the project root.

## Purpose

The `docs/` directory contains the documentation website for dora CLI at https://dora-cli.dev. This is a static site built with Astro that provides:

- Landing page with quick start instructions
- Comprehensive documentation for users
- Command reference guide
- Architecture and design philosophy
- AI agent integration examples

## Tech Stack

- **Framework:** Astro 5.x (static site generator)
- **Styling:** Tailwind CSS 4.x with `@tailwindcss/vite` plugin
- **Icons:** lucide-astro (Terminal, Zap, Database, etc.)
- **Font:** DM Sans (loaded from Google Fonts)
- **Deployment:** Cloudflare Workers via @astrojs/cloudflare adapter
- **Build Tool:** Bun (package manager and runtime)

## Project Structure

```
docs/
├── src/
│   ├── pages/
│   │   ├── index.astro         # Landing page (hero, features, quick start)
│   │   ├── docs.astro          # Full documentation page
│   │   ├── commands.astro      # Command reference
│   │   ├── architecture.astro  # Design philosophy & use cases
│   │   └── og-image.astro      # Open Graph image generator
│   └── layouts/
│       └── Layout.astro        # Base layout (head tags, nav, footer)
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.js          # Tailwind CSS 4.x config
└── astro.config.mjs           # Astro + Cloudflare config
```

## Pages Overview

### 1. Landing Page (`src/pages/index.astro`)

The main entry point with several key sections:

**Hero Section:**
- Large "dora" title with Terminal icon
- Tagline: "the explorer for your codebase"
- Two CTAs: "Quick Start" and "Documentation"

**AI Agent Comparison:**
- Side-by-side comparison of typical AI workflows vs. dora commands
- Examples: finding classes, analyzing dependencies, understanding architecture
- Uses monospace font and color-coded boxes (zinc-900 vs. blue-900)

**Feature Cards:**
- Grid layout with icon, title, and description
- Features: Fast queries, dependency tracking, symbol search, etc.
- Icons from lucide-astro (Database, Network, Search, etc.)

**Quick Start Section:**
- Dynamic platform detection (macOS/Linux/Windows)
- Language selector for SCIP indexer installation (9 languages)
- Installation command generation based on selections
- Step-by-step workflow examples

**Platform/Language Detection Logic:**
The landing page includes client-side JavaScript for dynamic installation instructions:

```javascript
// Platform detection (macOS, Linux, Windows)
const platform = navigator.platform.includes('Mac') ? 'macos'
              : navigator.platform.includes('Win') ? 'windows'
              : 'linux';

// Language selector (TypeScript, JavaScript, Go, etc.)
const languages = ['typescript', 'javascript', 'go', 'rust', 'java',
                  'python', 'ruby', 'c', 'cpp'];
```

### 2. Documentation Page (`src/pages/docs.astro`)

Comprehensive user guide with sections:

- **What is dora?** - Overview and purpose
- **Installation** - Platform-specific instructions
- **Quick Start** - Initialize, index, basic queries
- **Core Concepts** - SCIP indexes, symbols, dependencies
- **Command Overview** - Brief description of all command categories
- **AI Agent Integration** - How AI agents should use dora
- **Common Workflows** - Real-world usage patterns
- **Troubleshooting** - FAQ and common issues

**Styling Pattern:**
- Prose sections with `text-zinc-300` for readability
- Code blocks with `bg-zinc-900 border-zinc-800` background
- Headers with gradient text (`text-blue-400`)
- Links with `text-blue-400 hover:text-blue-300` transitions

### 3. Command Reference (`src/pages/commands.astro`)

Organized into 5 command categories:

1. **Setup & Status** - init, index, status, map, ls
2. **Query Commands** - file, symbol, refs, deps, rdeps, adventure
3. **Analysis Commands** - cycles, coupling, complexity, treasure, lost, leaves
4. **Graph & Export** - graph, exports, imports
5. **Advanced** - schema, query, changes

**Command Card Structure:**
```astro
<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
  <h3 class="text-xl font-semibold text-blue-400 mb-2">
    dora command [args]
  </h3>
  <p class="text-zinc-400 mb-4">Description of what it does</p>
  <div class="bg-zinc-950 p-3 rounded">
    <code>Example usage</code>
  </div>
</div>
```

### 4. Architecture Page (`src/pages/architecture.astro`)

Explains the design philosophy and technical implementation:

**Sections:**
- **Design Philosophy** - Why dora exists, goals, principles
- **How It Works** - SCIP indexing, protobuf parsing, SQLite storage
- **Performance** - Denormalized fields, incremental indexing
- **Use Cases** - AI agents, code exploration, refactoring, onboarding

**Visual Hierarchy:**
- Large section headers with bottom borders
- Subsections with icon bullets
- Code examples with syntax highlighting
- Callout boxes for important notes

### 5. OG Image (`src/pages/og-image.astro`)

Generates Open Graph images for social media sharing:
- Simple text-based design with "dora" title
- Blue gradient background matching brand colors
- Used in meta tags for link previews

## Styling Guidelines

### Color Scheme

**Primary Colors:**
- Blue: `blue-500` (primary actions), `blue-400` (text/links), `blue-300` (hover)
- Background: `zinc-950` (page bg), `zinc-900` (cards), `zinc-800` (borders)
- Text: `zinc-300` (body), `zinc-400` (muted), `zinc-500` (disabled)

**Usage:**
```astro
<!-- Primary button -->
<button class="bg-blue-500 hover:bg-blue-600 text-white">

<!-- Secondary button -->
<button class="border-2 border-blue-500 hover:bg-blue-500/10 text-blue-400">

<!-- Card -->
<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6">

<!-- Code block -->
<pre class="bg-zinc-950 border border-zinc-800 p-4 rounded">
```

### Typography

**Font:** DM Sans (loaded in Layout.astro)
```css
font-family: 'DM Sans', sans-serif;
```

**Text Sizes:**
- Hero: `text-6xl` (96px)
- H1: `text-4xl` (36px)
- H2: `text-3xl` (30px)
- H3: `text-xl` (20px)
- Body: `text-base` (16px)
- Small: `text-sm` (14px)

**Font Weights:**
- Headings: `font-bold` (700)
- Buttons: `font-semibold` (600)
- Body: `font-normal` (400)

### Layout Patterns

**Max Width Container:**
```astro
<div class="max-w-6xl mx-auto px-6 py-20">
  <!-- Content -->
</div>
```

**Card Grid:**
```astro
<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Cards -->
</div>
```

**Responsive Spacing:**
- Use `px-6` for horizontal padding on mobile
- Use `py-20` for generous vertical spacing between sections
- Use `gap-6` or `gap-8` for grid gaps

### Component Patterns

**Icon + Text Button:**
```astro
import { Zap } from "lucide-astro";

<button class="flex items-center gap-2">
  <Zap class="w-5 h-5" />
  <span>Quick Start</span>
</button>
```

**Feature Card:**
```astro
<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
  <Database class="w-8 h-8 text-blue-400 mb-4" />
  <h3 class="text-xl font-semibold mb-2">Fast Queries</h3>
  <p class="text-zinc-400">Description text</p>
</div>
```

**Code Comparison (Before/After):**
```astro
<div class="grid md:grid-cols-2 gap-3">
  <div class="bg-zinc-900 border border-zinc-800 rounded p-3">
    <div class="text-zinc-500 mb-1"># Without dora</div>
    <div class="text-zinc-300">grep -rn "class Logger"</div>
  </div>
  <div class="bg-zinc-900 border border-blue-900/50 rounded p-3">
    <div class="text-zinc-500 mb-1"># With dora</div>
    <div class="text-blue-300">dora symbol Logger</div>
  </div>
</div>
```

## Dynamic Features

### Platform Detection

The landing page detects the user's OS to show appropriate installation instructions:

**Implementation:**
```javascript
// In index.astro <script> tag
const platform = navigator.platform.includes('Mac') ? 'macos'
              : navigator.platform.includes('Win') ? 'windows'
              : 'linux';

// Show relevant commands
if (platform === 'macos') {
  // Show: brew install scip-typescript
} else if (platform === 'windows') {
  // Show: npm install -g scip-typescript
}
```

### Language Selector

Users can select their programming language to get appropriate SCIP indexer installation:

**Supported Languages:**
1. TypeScript (scip-typescript) - default
2. JavaScript (scip-typescript)
3. Go (scip-go)
4. Rust (rust-analyzer)
5. Java (scip-java)
6. Python (scip-python)
7. Ruby (scip-ruby)
8. C (scip-clang)
9. C++ (scip-clang)

**How to Add New Languages:**

1. Update the language selector in `index.astro`:
```javascript
const languages = {
  'newlang': {
    name: 'NewLang',
    indexer: 'scip-newlang',
    install: 'npm install -g scip-newlang',
    index: 'scip-newlang index'
  }
};
```

2. Add corresponding UI in the language selector dropdown
3. Update the documentation page with new language info
4. Test installation commands and workflows

### Installation Command Generation

Based on platform + language selection, the page generates:
- Indexer installation command
- dora installation command
- Example `dora init` and `dora index` commands

## Content Update Guidelines

### When to Update Documentation

**Always update docs when:**
1. Adding new commands to dora CLI
2. Changing command behavior or flags
3. Adding support for new languages/indexers
4. Updating installation procedures
5. Adding new features or capabilities
6. Changing configuration format

**Consider updating docs for:**
- Performance improvements (if user-visible)
- New best practices or workflows
- Common troubleshooting issues
- Integration examples with new AI tools

### Keeping Commands in Sync

The command reference page should mirror commands documented in `../CLAUDE.md`:

**Process:**
1. Check `../CLAUDE.md` for command specifications
2. Update `commands.astro` with matching information
3. Ensure flags, arguments, and examples are consistent
4. Test commands to verify accuracy
5. Update "Command Overview" section in `docs.astro` if needed

**Key Commands to Watch:**
- New query commands (symbol, file, deps, etc.)
- New analysis commands (cycles, coupling, complexity)
- Changes to `dora index` flags or behavior
- New output formats or options

### Code Example Formatting

**Use consistent formatting for code blocks:**

```astro
<!-- Inline code -->
<code class="bg-zinc-900 px-2 py-1 rounded text-blue-400">dora init</code>

<!-- Code block -->
<pre class="bg-zinc-950 border border-zinc-800 p-4 rounded overflow-x-auto"><code class="text-sm text-zinc-300">dora symbol Logger --kind interface
dora deps src/app.ts --depth 2</code></pre>
```

**Guidelines:**
- Use real, tested commands (not made-up examples)
- Show expected output when helpful
- Include comments explaining non-obvious behavior
- Use consistent formatting across all pages

### Screenshot/Diagram Conventions

Currently the site uses text-based examples rather than screenshots. If adding visual content:

- Save images to `public/images/`
- Use descriptive filenames (e.g., `dora-deps-example.png`)
- Optimize images (use WebP format when possible)
- Add alt text for accessibility
- Reference with `/images/filename.png` in Astro components

## Deployment

### Development Server

```bash
# Start dev server (with hot reload)
cd docs
bun run dev

# Open http://localhost:4321
```

### Building for Production

```bash
# Build static site + Cloudflare adapter
cd docs
bun run build

# Output: dist/ directory
```

### Deploying to Cloudflare

The site is deployed to https://dora-cli.dev using Cloudflare Workers:

```bash
# Deploy to production
cd docs
bun run deploy

# This runs: wrangler deploy
```

**Deployment Configuration:**
- Adapter: `@astrojs/cloudflare` (configured in `astro.config.mjs`)
- Output mode: Hybrid (mostly static with SSR for OG images)
- Custom domain: dora-cli.dev (configured in Cloudflare dashboard)

**Environment Variables:**
None required for current setup. If adding dynamic features (API calls, etc.), configure in Cloudflare Workers dashboard.

## Maintenance Tasks

### Regular Updates

**Monthly:**
- Review command documentation for accuracy
- Check for broken links (internal and external)
- Update version numbers if dora CLI releases new version
- Test installation commands on different platforms

**When Adding Features:**
- Update relevant page(s) with new feature documentation
- Add examples showing how to use the new feature
- Update landing page feature list if user-facing
- Update AI agent integration guide if relevant

### Syncing with Main CLAUDE.md

The docs site should reflect commands and concepts from `../CLAUDE.md`:

**Checklist:**
- [ ] All commands in `../CLAUDE.md` are documented in `commands.astro`
- [ ] Command flags and arguments match implementation
- [ ] Examples use real, tested commands
- [ ] Database schema references are accurate (if mentioned)
- [ ] Workflow examples align with best practices

**How to Sync:**
1. Read the Commands section in `../CLAUDE.md`
2. Compare with command reference in `docs/src/pages/commands.astro`
3. Update descriptions, flags, or examples that have changed
4. Add any new commands that were added
5. Remove or deprecate commands that were removed

### Adding New SCIP Indexer Languages

When a new language is supported by SCIP ecosystem:

1. **Research the indexer:**
   - Package name (e.g., `scip-kotlin`)
   - Installation method (npm, cargo, go install, etc.)
   - Index command format
   - Configuration requirements

2. **Update index.astro:**
   - Add language to `languages` object
   - Add installation instructions
   - Add example configuration

3. **Update docs.astro:**
   - Add language to supported languages list
   - Include installation instructions
   - Add any language-specific notes

4. **Test the workflow:**
   - Install the indexer
   - Run on sample project
   - Verify dora can parse the output
   - Document any gotchas

### Testing Responsive Design

The site should work on desktop, tablet, and mobile:

**Breakpoints (Tailwind CSS):**
- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up

**Test on:**
- Mobile (375px width) - Navigation should stack, grids collapse to single column
- Tablet (768px width) - 2-column grids, readable text
- Desktop (1280px+) - 3-column grids, full layout

**Key Areas to Test:**
- Navigation menu (hamburger on mobile)
- Feature card grids
- Code comparison sections
- Installation instruction sections

### Checking Broken Links

**Internal Links:**
```bash
# Build the site and check for 404s
bun run build
# Manually test navigation between pages
```

**External Links:**
- GitHub repository links
- SCIP protocol documentation
- Package manager links (npm, brew, cargo, etc.)
- AI tool integration links

## Notes

- The site uses Astro's `.astro` format, which combines HTML, CSS, and JavaScript
- Tailwind CSS 4.x uses `@tailwindcss/vite` instead of PostCSS
- All icons come from lucide-astro (import components directly)
- The site is mostly static - only OG image generation uses SSR
- Cloudflare Workers provides edge deployment for fast global access
- Custom domain (dora-cli.dev) is configured in Cloudflare dashboard, not in code

## Typical Updates

### Adding a New Command

1. Update `../CLAUDE.md` with command specification (done by CLI team)
2. Add command card to `docs/src/pages/commands.astro` in appropriate category
3. If major command, mention in `docs.astro` command overview
4. Test the command and include real output examples
5. Deploy updates to production

### Updating Installation Instructions

1. Test new installation method on all platforms
2. Update `index.astro` quick start section
3. Update `docs.astro` installation section
4. Update platform/language detection logic if needed
5. Verify commands work as documented
6. Deploy updates

### Redesigning a Section

1. Update the relevant `.astro` file(s)
2. Ensure Tailwind classes follow established patterns
3. Test responsive design on mobile/tablet/desktop
4. Check color contrast for accessibility
5. Verify icons and images load correctly
6. Get feedback before deploying major changes
