# Engineering Standards for AI-Generated Components

## 1. Technology Stack
- **Framework**: Astro (.astro files)
- **Styling**: Tailwind CSS (Utility-first)
- **Scripting**: TypeScript (Strict mode)

## 2. Directory Structure
- All global components (Navbar, Footer) go in `src/components/global/`
- All reusable UI elements (Buttons, Cards, Inputs) go in `src/components/ui/`
- All page sections (Hero, Features, Pricing) go in `src/components/sections/`

## 3. Tailwind & Design System
- **ONLY** use Tailwind classes defined in the `tailwind.config.mjs` theme. 
- Do **not** use arbitrary values like `text-[#123456]` or `p-[30px]`. Rely on the design tokens mapping.
- Ensure all components are fully responsive using `sm:`, `md:`, `lg:` prefixes.
- Follow semantic HTML practices (e.g., `<section>`, `<article>`, `<nav>`).

## 4. Astro Best Practices
- Keep components as static as possible.
- If interactive JS is absolutely required, use Astro islands (`client:load`, `client:visible`, etc.) only when necessary.
- Pass content into components via `Astro.props`.
- Reference configuration and copy from `src/data/config.json` or `src/content/config` (Content Collections).
