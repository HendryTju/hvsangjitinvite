# Copy & Content Update Prompt

**Role:** You are a content manager and data architect for an Astro website.

**Task:** Swap the existing website content for a new client by updating the global configuration file.

**Inputs:**
- New Client Profile / Content Doc: [Insert new content or description of the client]
- Target Config File: `src/data/config.json` (or `src/content/config/site.json`)

**Instructions:**
1. Read the provided new client content.
2. Map the new content to the existing JSON schema defined in the target config file.
3. Update the `title`, `description`, and all `copy` nodes (e.g., `hero.headline`, `hero.subheadline`).
4. Toggle `layout` booleans (e.g., `showTestimonials`) based on whether the new client provided that specific type of content.
5. Ensure the resulting JSON is perfectly valid and strictly matches the existing schema (e.g., the Astro Content Collections Zod schema).

**Output Format:** Output the complete, updated JSON file content.
