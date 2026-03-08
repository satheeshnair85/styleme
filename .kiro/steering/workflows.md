# Common Workflows

## Setting Up Development Environment

### Prerequisites
1. Install Node.js (v18 or higher)
2. Install Shopify CLI: `npm install -g @shopify/cli @shopify/theme`
3. Configure AWS CLI with credentials
4. Create Shopify Partner account and development store
5. Set up Shiprocket test account

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd ShopifyWebsite

# Install dependencies
npm install

# Copy environment template
copy .env.example .env

# Edit .env with your credentials
notepad .env

# Authenticate with Shopify
shopify auth login

# Connect to your development store
shopify theme dev --store=your-dev-store.myshopify.com
```

### AWS Setup
```bash
# Configure AWS credentials
aws configure

# Deploy Lambda functions (if using Serverless Framework)
cd backend
npm install
serverless deploy --stage dev

# Or deploy manually
aws lambda create-function --function-name bedrock-generator --runtime nodejs18.x --handler index.handler --zip-file fileb://function.zip
```

## Adding a New Product Type

### 1. Update Product Configuration
```javascript
// config/products.js
export const PRODUCT_TYPES = {
  tshirt: {
    name: 'T-Shirt',
    printArea: { width: 12, height: 16 }, // inches
    mockupTemplate: 'tshirt-mockup.png'
  },
  mug: {
    name: 'Mug',
    printArea: { width: 8, height: 3 },
    mockupTemplate: 'mug-mockup.png'
  },
  // Add new product type
  hoodie: {
    name: 'Hoodie',
    printArea: { width: 12, height: 16 },
    mockupTemplate: 'hoodie-mockup.png'
  }
};
```

### 2. Create Shopify Product
- Add product in Shopify admin
- Set up variants (sizes, colors)
- Add product metafields for customization
- Upload mockup images

### 3. Update Frontend
```liquid
<!-- snippets/product-selector.liquid -->
<select name="product-type" id="product-type">
  <option value="tshirt">T-Shirt</option>
  <option value="mug">Mug</option>
  <option value="hoodie">Hoodie</option>
</select>
```

### 4. Update Backend Logic
- Adjust print specifications
- Update Shiprocket product mapping
- Test fulfillment flow

## Implementing a New AI Model

### 1. Update Bedrock Configuration
```javascript
// lib/bedrock-client.js
const MODELS = {
  'stable-diffusion-xl': {
    modelId: 'stability.stable-diffusion-xl-v1',
    maxTokens: 77,
    defaultParams: {
      cfg_scale: 7,
      steps: 50
    }
  },
  // Add new model
  'titan-image': {
    modelId: 'amazon.titan-image-generator-v1',
    maxTokens: 512,
    defaultParams: {
      numberOfImages: 1,
      quality: 'premium'
    }
  }
};
```

### 2. Update Generation Logic
```javascript
async function generateWithModel(prompt, modelType) {
  const model = MODELS[modelType];
  const params = {
    modelId: model.modelId,
    body: JSON.stringify({
      prompt,
      ...model.defaultParams
    })
  };
  
  const response = await bedrockClient.invokeModel(params);
  return processResponse(response, modelType);
}
```

### 3. Test New Model
- Test with various prompts
- Validate output quality
- Check generation time
- Monitor costs

## Handling Order Fulfillment

### Order Creation Flow
```javascript
// functions/shopify-webhook/index.js
export async function handler(event) {
  const order = JSON.parse(event.body);
  
  // 1. Validate webhook signature
  if (!validateWebhook(event.headers, event.body)) {
    return { statusCode: 401, body: 'Invalid signature' };
  }
  
  // 2. Extract design information
  const designUrl = order.note_attributes.find(
    attr => attr.name === 'design_url'
  )?.value;
  
  // 3. Create Shiprocket order
  const shiprocketOrder = await createShiprocketOrder({
    orderId: order.id,
    designUrl,
    items: order.line_items,
    customer: order.customer,
    shipping: order.shipping_address
  });
  
  // 4. Update Shopify with fulfillment info
  await updateShopifyFulfillment(order.id, shiprocketOrder.id);
  
  return { statusCode: 200, body: 'Success' };
}
```

### Tracking Updates
```javascript
// Poll Shiprocket for updates
async function syncTrackingInfo() {
  const pendingOrders = await getPendingOrders();
  
  for (const order of pendingOrders) {
    const tracking = await shiprocket.getTracking(order.shiprocketId);
    
    if (tracking.status !== order.lastStatus) {
      await updateShopifyOrder(order.shopifyId, {
        status: mapStatus(tracking.status),
        trackingNumber: tracking.awb_code,
        trackingUrl: tracking.tracking_url
      });
    }
  }
}
```

## Debugging Common Issues

### TLS Certificate Errors (Local Development)

This development machine has a TLS certificate issue that affects any local command talking to Shopify's API. This does NOT affect deployed Lambda functions (they run in AWS).

**Symptoms:**
- `unable to get local issuer certificate` errors
- Shopify CLI commands hanging or failing

**Fix:** Always prefix Shopify CLI and local scripts with the correct format for automated execution:
```powershell
# Automated execution (no manual Enter required)
echo y | $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; shopify theme push --development --json 2>&1

# Alternative format
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; echo y | shopify theme push --development --json 2>&1
```

**Command Examples:**
```powershell
# Push theme changes
echo y | $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; shopify theme push --development --json 2>&1

# Pull theme changes
echo y | $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; shopify theme pull --development --json 2>&1

# Start development server
echo y | $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; shopify theme dev --json 2>&1
```

The credential validation script and deployment script already handle this automatically.

### Design Generation Fails

**Check:**
1. AWS credentials are valid
2. Bedrock model is available in region
3. Prompt doesn't violate content policy
4. Lambda has sufficient timeout
5. S3 bucket permissions are correct

**Debug:**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/bedrock-generator --follow

# Test Bedrock directly
aws bedrock-runtime invoke-model \
  --model-id stability.stable-diffusion-xl-v1 \
  --body '{"prompt":"test"}' \
  output.json
```

### Webhook Not Triggering

**Check:**
1. Webhook is registered in Shopify
2. Endpoint URL is correct and accessible
3. Webhook signature validation is working
4. Lambda/API Gateway is deployed

**Debug:**
```bash
# Check Shopify webhook status
curl -X GET "https://your-store.myshopify.com/admin/api/2024-01/webhooks.json" \
  -H "X-Shopify-Access-Token: YOUR_TOKEN"

# Test webhook manually
curl -X POST "https://your-api.com/webhook/shopify" \
  -H "Content-Type: application/json" \
  -d @test-order.json
```

### Shiprocket Order Creation Fails

**Check:**
1. Shiprocket credentials are valid
2. Order format matches API requirements
3. Product dimensions are specified
4. Shipping address is complete

**Debug:**
```javascript
// Log full request/response
console.log('Shiprocket Request:', JSON.stringify(orderData, null, 2));
try {
  const response = await shiprocket.createOrder(orderData);
  console.log('Shiprocket Response:', response);
} catch (error) {
  console.error('Shiprocket Error:', error.response?.data);
}
```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Database migrations ready (if any)
- [ ] Backup current production state

### Deployment Steps
```bash
# 1. Deploy backend
cd backend
serverless deploy --stage production

# 2. Deploy Shopify theme
shopify theme push --store=your-store.myshopify.com

# 3. Update environment variables
aws lambda update-function-configuration \
  --function-name bedrock-generator \
  --environment Variables={KEY=VALUE}

# 4. Test critical paths
npm run test:smoke
```

### Post-Deployment
- [ ] Verify design generation works
- [ ] Test order creation
- [ ] Check webhook processing
- [ ] Monitor error rates
- [ ] Verify tracking updates
- [ ] Test on mobile devices

### Rollback Procedure
```bash
# Rollback Lambda
aws lambda update-function-code \
  --function-name bedrock-generator \
  --s3-bucket deployments \
  --s3-key previous-version.zip

# Rollback Shopify theme
shopify theme push --theme=PREVIOUS_THEME_ID
```

## Monitoring and Maintenance

### Daily Checks
- Review error logs in CloudWatch
- Check order fulfillment rate
- Monitor Bedrock costs
- Verify webhook processing

### Weekly Tasks
- Review customer feedback
- Analyze generation success rates
- Check S3 storage usage
- Update dependencies

### Monthly Tasks
- Review and optimize costs
- Update documentation
- Security audit
- Performance optimization
- Clean up old designs from S3
