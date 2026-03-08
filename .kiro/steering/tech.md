# Technology Stack

## Platform

- **Environment**: Windows (cmd shell)
- **E-commerce Platform**: Shopify
- **Hosting**: Shopify-hosted storefront

## Tech Stack

### Frontend
- **Shopify Liquid**: Templating engine for theme customization
- **JavaScript/TypeScript**: Interactive UI components
- **CSS/SCSS**: Styling and responsive design
- **Shopify Theme Kit** or **Shopify CLI**: Theme development and deployment

### Backend & Integrations
- **Amazon Bedrock**: AI image generation service
  - Models: Stable Diffusion, Titan Image Generator, or similar
  - AWS SDK for API integration
- **Shopify APIs**:
  - Storefront API: Customer-facing operations
  - Admin API: Order management and product updates
- **Shiprocket API**: Order fulfillment and shipping integration
- **Serverless Functions**: AWS Lambda or Shopify Functions for backend logic

### Infrastructure
- **AWS Services**:
  - Amazon Bedrock: AI image generation
  - S3: Design image storage
  - Lambda: Serverless compute for AI processing
  - API Gateway: REST API endpoints
  - CloudWatch: Logging and monitoring
- **Shopify Apps**: Custom app for backend integration

### Development Tools
- **Node.js**: Runtime for build tools and serverless functions
- **npm/yarn**: Package management
- **Git**: Version control
- **Postman/Insomnia**: API testing

## Common Commands

### Development

```bash
# Start Shopify theme development server
shopify theme dev

# Watch for theme changes
shopify theme dev --store=your-store.myshopify.com

# Install dependencies
npm install
```

### Build

```bash
# Build assets (if using custom build process)
npm run build

# Package theme
shopify theme package
```

### Testing

```bash
# Run unit tests
npm test

# Test API integrations
npm run test:integration

# Validate Liquid templates
shopify theme check
```

### Deployment

```bash
# Deploy theme to Shopify
shopify theme push

# Deploy to production
shopify theme push --store=your-store.myshopify.com --theme=THEME_ID

# Deploy AWS Lambda functions
aws lambda update-function-code --function-name bedrock-image-generator

# Or using Serverless Framework
serverless deploy
```

## Environment Variables

Required environment variables for integrations:

```bash
# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
BEDROCK_MODEL_ID=stability.stable-diffusion-xl-v1

# Shopify
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret

# Shiprocket
SHIPROCKET_EMAIL=your-email
SHIPROCKET_PASSWORD=your-password
SHIPROCKET_API_URL=https://apiv2.shiprocket.in/v1/external

# Storage
S3_BUCKET_NAME=custom-designs-bucket
```

## Dependencies

Key dependencies tracked in package.json:

- `@aws-sdk/client-bedrock-runtime`: Amazon Bedrock integration
- `@shopify/shopify-api`: Shopify API client
- `axios`: HTTP client for API calls
- `dotenv`: Environment variable management
- `sharp`: Image processing and optimization
