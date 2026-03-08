# AI Custom Merchandise - Shopify Theme

A mobile-first Progressive Web App (PWA) theme for AI-powered custom merchandise on Shopify.

## Features

- 📱 Mobile-first responsive design
- 🚀 Progressive Web App (PWA) capabilities
- 🎨 Modern, clean UI with gradient hero section
- 🛒 Cart and Login buttons in header
- 📦 Product grid for customizable merchandise
- ⚡ Fast loading with service worker caching
- ♿ Accessibility-focused design

## Project Structure

```
├── assets/              # CSS, JavaScript, images
│   ├── theme.css       # Main stylesheet (mobile-first)
│   ├── theme.js        # Theme JavaScript
│   ├── manifest.json   # PWA manifest
│   └── service-worker.js # Service worker for offline support
├── config/             # Theme configuration
│   └── settings_schema.json
├── layout/             # Theme layouts
│   └── theme.liquid
├── sections/           # Reusable sections
│   ├── header.liquid   # Header with login/cart buttons
│   ├── hero.liquid     # Hero section
│   ├── product-grid.liquid # Product grid
│   └── footer.liquid
└── templates/          # Page templates
    └── index.json      # Homepage template
```

## Prerequisites

- Node.js (v18 or higher) ✅ Installed
- Shopify CLI ✅ Installed
- Shopify Partner account or store access

## Deployment Instructions

### Step 1: Authenticate with Shopify

```bash
shopify auth login
```

This will open your browser to authenticate with your Shopify account.

### Step 2: Connect to Your Store

```bash
shopify theme dev --store=your-store.myshopify.com
```

Replace `your-store.myshopify.com` with your actual store URL.

This will:
- Start a local development server
- Upload the theme to your store
- Provide a preview URL
- Watch for file changes and auto-sync

### Step 3: Deploy to Production

Once you're happy with the theme:

```bash
shopify theme push --store=your-store.myshopify.com
```

Or to publish directly:

```bash
shopify theme push --store=your-store.myshopify.com --live
```

## Alternative: Manual Upload

If you prefer to upload manually:

1. Create a ZIP file of the theme (excluding .kiro, node_modules, etc.)
2. Go to your Shopify Admin → Online Store → Themes
3. Click "Add theme" → "Upload ZIP file"
4. Upload and publish

## Development

### Local Development

```bash
# Start development server with live reload
shopify theme dev --store=your-store.myshopify.com

# The theme will be available at the provided preview URL
```

### Customization

The theme is built with customization in mind:

- **Colors**: Edit CSS variables in `assets/theme.css`
- **Content**: Use Shopify theme editor or edit section settings
- **Layout**: Modify sections in `sections/` directory
- **PWA**: Update `assets/manifest.json` for app settings

## PWA Features

The theme includes Progressive Web App capabilities:

- **Installable**: Users can install the store as an app
- **Offline Support**: Service worker caches assets for offline browsing
- **Fast Loading**: Optimized caching strategies
- **Push Notifications**: Ready for order updates (requires setup)

### Testing PWA

1. Deploy the theme
2. Open your store in Chrome/Edge
3. Look for the "Install" button in the address bar
4. Test offline by disabling network in DevTools

## Mobile-First Design

The theme is designed mobile-first with breakpoints:

- **Mobile**: 320px - 767px (default styles)
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+

All touch targets are minimum 44x44px for accessibility.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Next Steps

1. **Add Products**: Create products in Shopify admin
2. **Upload Images**: Add product images and hero image
3. **Customize Colors**: Edit CSS variables to match your brand
4. **Add PWA Icons**: Create and upload icon-192.png and icon-512.png to assets/
5. **Configure Pages**: Create customize, about, contact pages
6. **Set up AI Integration**: Implement AWS Bedrock integration (see requirements.md)

## Support

For issues or questions:
- Check Shopify CLI documentation: https://shopify.dev/docs/themes/tools/cli
- Review theme requirements: `.kiro/specs/ai-custom-merchandise/requirements.md`

## License

Custom theme for AI Custom Merchandise platform.
