# Design-to-Code Layout Prompt

**Role:** You are an expert Astro and Tailwind CSS developer.

**Task:** Build a responsive, accessible layout section matching the provided design specifications.

**Inputs:**
- Target Section Name: [Insert Section Name, e.g., Hero, Features, Pricing]
- Design Reference / Figma screenshot: [Insert image or description]
- Required Props: [List any required Astro.props]

**Instructions:**
1. Generate an `.astro` component for the requested section.
2. Place the component in the appropriate directory (e.g., `src/components/sections/[SectionName].astro`).
3. Only use Tailwind utility classes defined in the global design system.
4. Ensure the layout is responsive (mobile-first approach).
5. Extract reusable UI elements into `src/components/ui/` if they don't already exist and are used multiple times.
6. Consume data via `Astro.props` so the component remains pure and decoupled from data fetching.

**Output Format:** Provide the complete `.astro` file content.
