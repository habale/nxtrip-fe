# Shared UI boundary

Application and feature presentation code should import controls from this directory's
`index.ts` instead of importing Ionic components directly.

The exported props intentionally use app-owned names and plain React/TypeScript values.
Ionic events and component prop types stay inside these adapters. Replacing the UI kit
should therefore require changing these files and the theme rather than every feature.

Global brand decisions live in `src/theme/theme.css`. Prefer its semantic tokens such as
`--color-primary`, `--radius-card`, and `--radius-pill` over one-off values in features.

Typography uses the bundled Plus Jakarta Sans font, and the `Icon` adapter maps app-owned
icon names to the bundled Material Symbols Outlined font. Both fonts are preloaded from
`public/fonts` in `index.html` so icon ligatures do not briefly render as raw names.
