# Quick Deployment Guide

## Option 1: Development Mode (Recommended for Testing)

This will let you preview the theme without affecting your live store:

```bash
shopify theme dev --store=YOUR-STORE.myshopify.com
```

**What this does:**
- Uploads theme to your store as a development theme
- Provides a preview URL
- Auto-syncs changes as you edit files
- Safe - doesn't affect your live store

**Steps:**
1. Open PowerShell/CMD in this directory
2. Run: `shopify theme dev --store=YOUR-STORE.myshopify.com`
3. Follow the authentication prompts
4. Open the preview URL provided
5. Test the mobile-first design on your phone!

## Option 2: Push to Store (For Publishing)

Once you're happy with the theme:

```bash
shopify theme push --store=YOUR-STORE.myshopify.com
```

**What this does:**
- Uploads theme to your store
- Creates a new unpublished theme
- You can then publish it from Shopify admin

**To publish immediately:**
```bash
shopify theme push --store=YOUR-STORE.myshopify.com --live
```

⚠️ **Warning:** This will replace your current live theme!

## First Time Setup

### 1. Authenticate with Shopify

```bash
shopify auth login
```

This opens your browser to log in to Shopify.

### 2. Find Your Store URL

Your store URL is typically:
- `your-store-name.myshopify.com`
- Find it in Shopify Admin → Settings → Store details

### 3. Start Development

```bash
shopify theme dev --store=your-store-name.myshopify.com
```

## Troubleshooting

### "Unable to get local issuer certificate"

This is a common SSL warning and won't prevent deployment. You can:
- Ignore it (it's just a warning)
- Or set: `set NODE_TLS_REJECT_UNAUTHORIZED=0` (Windows)

### "Store not found"

Make sure you're using the correct store URL format:
- ✅ `my-store.myshopify.com`
- ❌ `my-store.com`
- ❌ `https://my-store.myshopify.com`

### "Not authenticated"

Run: `shopify auth login` first

## What to Do After Deployment

1. **Add PWA Icons**
   - Create 192x192px and 512x512px PNG icons
   - Name them `icon-192.png` and `icon-512.png`
   - Upload to `assets/` folder

2. **Customize Content**
   - Go to Shopify Admin → Online Store → Themes
   - Click "Customize" on your theme
   - Edit hero text, add products, upload images

3. **Test Mobile**
   - Open your store on a mobile device
   - Test the login and cart buttons
   - Try installing as PWA (look for install prompt)

4. **Add Products**
   - Create products in Shopify admin
   - Link them in the product grid section

## Need Help?

- Shopify CLI Docs: https://shopify.dev/docs/themes/tools/cli
- Theme Development: https://shopify.dev/docs/themes
- PWA Guide: https://web.dev/progressive-web-apps/
