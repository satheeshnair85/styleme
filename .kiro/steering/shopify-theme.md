# Shopify Theme Development Rules

## Critical: CSS Variables and Settings Schema Alignment

When building a custom Shopify theme, the `settings_schema.json` and `theme.liquid` CSS variables MUST be in sync. This is the #1 cause of invisible content and broken themes.

### Rules

1. **Never reference undefined settings** — Every `settings.xxx` used in `theme.liquid` MUST have a corresponding entry in `config/settings_schema.json` with a default value.
2. **Use hardcoded CSS variable defaults** — For custom themes that don't need the full Dawn settings system, use hardcoded `:root` CSS variables instead of Liquid-generated ones. This avoids `rgb(, , )` rendering bugs when settings are undefined.
3. **Don't copy Dawn theme boilerplate blindly** — Dawn's `theme.liquid` references 100+ settings variables. A custom theme should only include what it actually uses.

### Correct Pattern

```html
<!-- Use hardcoded defaults for custom themes -->
<style>
  :root {
    --color-base-text: 31, 41, 55;
    --color-base-background-1: 255, 255, 255;
    --color-base-accent-1: 99, 102, 241;
    --page-width: 120rem;
    --buttons-radius: 8px;
  }
</style>
```

### Incorrect Pattern

```liquid
<!-- DON'T do this unless settings_schema.json defines colors_text -->
:root {
  --color-base-text: {{ settings.colors_text.red }}, {{ settings.colors_text.green }}, {{ settings.colors_text.blue }};
}
```

## Critical: All Referenced Files Must Exist

Before pushing a theme, verify that every file referenced in templates actually exists:

1. **Snippets** — Every `{% render 'snippet-name' %}` must have a corresponding `snippets/snippet-name.liquid` file.
2. **Sections** — Every section type referenced in JSON templates or section groups must have a matching `sections/xxx.liquid` file.
3. **Section Groups** — If `theme.liquid` uses `{% sections 'header-group' %}`, then `sections/header-group.json` must exist.
4. **Assets** — Every `{{ 'file.css' | asset_url | stylesheet_tag }}` must have the file in `assets/`.
5. **CSS files** — If a CSS file is preloaded, it must ALSO be loaded as a stylesheet. Preloading alone does not apply styles.

### Pre-Push Checklist

- [ ] All `{% render %}` snippets exist in `snippets/`
- [ ] All section types in JSON templates exist in `sections/`
- [ ] All section group JSON files exist
- [ ] All referenced CSS files are loaded (not just preloaded)
- [ ] All referenced JS files exist in `assets/`
- [ ] `settings_schema.json` defines all settings used in `theme.liquid`

## Critical: Stylesheet Loading

```liquid
<!-- WRONG: Only preloads, does not apply styles -->
<link rel="preload" href="{{ 'theme.css' | asset_url }}" as="style">

<!-- RIGHT: Actually loads the stylesheet -->
{{ 'theme.css' | asset_url | stylesheet_tag }}
```

If you preload a CSS file for performance, you MUST also include it as a stylesheet tag.

## Liquid Filter Safety

### font_url Filter
The `font_url` filter only works with actual font objects from theme settings. Always guard with a blank check:

```liquid
{%- if settings.type_body_font != blank -%}
  {%- unless settings.type_body_font.system? -%}
    <link rel="preload" as="font" href="{{ settings.type_body_font | font_url }}" type="font/woff2" crossorigin>
  {%- endunless -%}
{%- endif -%}
```

### img_url Filter
Always check if the image exists before using `img_url`:

```liquid
{% if product.featured_image %}
  <img src="{{ product.featured_image | img_url: '400x' }}" alt="{{ product.title }}">
{% endif %}
```

## Theme Deployment Verification

After every `shopify theme push`, verify the theme works by:

1. Checking the preview URL renders content (not a blank page)
2. Verifying text is visible (CSS variables are resolving correctly)
3. Confirming no Liquid errors in the browser console or dev server logs
4. Testing on both mobile and desktop viewports

## Critical: Shopify CLI Command Format

All Shopify CLI commands MUST be run with these flags to avoid SSL certificate errors and interactive prompts:

```powershell
# For automated execution (no manual Enter required)
echo y | $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; shopify theme push --development --json 2>&1

# Alternative format that also works
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; echo y | shopify theme push --development --json 2>&1
```

**Correct Command Examples:**
```powershell
# Push to development theme (automated)
echo y | $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; shopify theme push --development --json 2>&1

# Pull from theme (automated)  
echo y | $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; shopify theme pull --development --json 2>&1

# Start development server (automated)
echo y | $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; shopify theme dev --json 2>&1
```

**Rules:**
1. **Always prefix with `echo y |`** — This automatically answers "yes" to any prompts, preventing manual Enter requirements
2. **Always include `$env:NODE_TLS_REJECT_UNAUTHORIZED="0";`** — This avoids the "unable to get local issuer certificate" TLS error on this machine
3. **Always append `--json 2>&1`** — This produces clean JSON output and captures both stdout and stderr
4. **Use `--development` flag** — This targets the development theme (ID: 147725811805)

These flags apply to ALL Shopify CLI commands (`theme push`, `theme dev`, `theme pull`, etc.).

## Development Store Considerations

- Development stores on free plans have full theme functionality
- A blank page is NOT caused by plan limitations — it's always a code issue
- Use `shopify theme dev` for local development with hot reload
- Use `shopify theme push --development` for pushing to the development theme
- Always use `--json` flag for cleaner CI/CD output
- Development theme ID: `147725811805`
- Preview URL requires `?preview_theme_id=147725811805` parameter
