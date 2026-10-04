# Shared UI boundary

Application and feature presentation code should import controls from this directory's
`index.ts` instead of importing Ionic components directly.

The exported props intentionally use app-owned names and plain React/TypeScript values.
Ionic events and component prop types stay inside these adapters. Replacing the UI kit
should therefore require changing these files and the theme rather than every feature.

Global brand decisions live in `src/theme/theme.css`. Prefer its semantic tokens such as
`--color-primary`, `--radius-card`, and `--radius-pill` over one-off values in features.

Typography uses Plus Jakarta Sans and the `Icon` adapter maps app-owned icon names to
Google Material Symbols Rounded. Both font families are loaded in `index.html`.
