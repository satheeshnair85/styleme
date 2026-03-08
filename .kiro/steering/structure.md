# Project Structure

## Current Organization

```
.kiro/
  steering/     # AI assistant guidance documents
```

## Recommended Structure

### Shopify Theme Structure

```
/
├── assets/              # CSS, JavaScript, images, fonts
│   ├── styles.css
│   ├── custom-design.js
│   └── product-images/
├── config/              # Theme settings and configuration
│   ├── settings_schema.json
│   └── settings_data.json
├── layout/              # Theme layouts
│   └── theme.liquid
├── locales/             # Translation files
│   └── en.default.json
├── sections/            # Reusable sections
│   ├── header.liquid
│   ├── footer.liquid
│   ├── product-customizer.liquid
│   └── mood-input.liquid
├── snippets/            # Reusable code snippets
│   ├── design-preview.liquid
│   ├── product-selector.liquid
│   └── ai-status.liquid
├── templates/           # Page templates
│   ├── index.liquid
│   ├── product.liquid
│   ├── collection.liquid
│   └── customers/
└── .shopifyignore
```

### Backend/Serverless Structure

```
/backend/
├── functions/           # AWS Lambda functions
│   ├── bedrock-generator/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── utils/
│   ├── shopify-webhook/
│   │   └── index.js
│   └── shiprocket-fulfillment/
│       └── index.js
├── lib/                 # Shared libraries
│   ├── bedrock-client.js
│   ├── shopify-client.js
│   └── shiprocket-client.js
├── config/              # Configuration files
│   ├── aws-config.js
│   └── api-endpoints.js
└── tests/               # Backend tests
    ├── bedrock.test.js
    └── integration.test.js
```

### Shopify App Structure (if building custom app)

```
/shopify-app/
├── web/
│   ├── frontend/        # React admin UI
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   └── backend/         # Node.js backend
│       ├── routes/
│       ├── middleware/
│       └── index.js
├── extensions/          # Shopify app extensions
│   └── theme-app-extension/
└── shopify.app.toml
```

## Key Files

### Configuration Files
- `.env` - Environment variables (never commit!)
- `.env.example` - Template for required environment variables
- `package.json` - Node.js dependencies
- `shopify.theme.toml` - Shopify theme configuration
- `serverless.yml` - AWS Lambda deployment config (if using Serverless Framework)

### Integration Files
- `bedrock-integration.js` - Amazon Bedrock API wrapper
- `shopify-integration.js` - Shopify API wrapper
- `shiprocket-integration.js` - Shiprocket API wrapper

## Conventions

### File Naming
- Liquid files: `kebab-case.liquid`
- JavaScript files: `camelCase.js` or `kebab-case.js`
- CSS files: `kebab-case.css`
- Lambda functions: `kebab-case/index.js`

### Code Organization
- Keep Liquid templates focused on presentation
- Move complex logic to JavaScript or backend functions
- Use snippets for reusable UI components
- Use sections for page-level components
- Separate API integration logic into dedicated modules

### API Integration Patterns
- **Frontend → Backend → AWS Bedrock**: Customer submits mood/image → Shopify app/Lambda processes → Bedrock generates → Store in S3 → Return URL
- **Shopify → Shiprocket**: Order webhook → Lambda function → Shiprocket API → Fulfillment
- Use webhooks for asynchronous operations
- Implement retry logic for external API calls
- Cache generated designs to avoid regeneration

### Design Storage
- Store generated designs in AWS S3
- Use Shopify metafields to link designs to orders
- Implement cleanup policy for unused designs (e.g., 30 days)

### Error Handling
- Graceful degradation if AI generation fails
- User-friendly error messages
- Logging to CloudWatch for debugging
- Fallback designs or retry mechanisms
