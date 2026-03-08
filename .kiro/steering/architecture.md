# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Customer Browser                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Shopify Storefront (Liquid + JavaScript)          │     │
│  │  - Mood Input Form                                  │     │
│  │  - Image Upload                                     │     │
│  │  - Product Selector                                 │     │
│  │  - Design Preview                                   │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Shopify Platform                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Shopify Store                                      │     │
│  │  - Product Catalog                                  │     │
│  │  - Cart & Checkout                                  │     │
│  │  - Order Management                                 │     │
│  │  - Webhooks                                         │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  API Gateway                                        │     │
│  │  - /generate-design (POST)                          │     │
│  │  - /webhook/shopify (POST)                          │     │
│  └────────────────────────────────────────────────────┘     │
│                            │                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Lambda Functions                                   │     │
│  │  - bedrock-generator: AI image generation           │     │
│  │  - shopify-webhook: Order processing                │     │
│  │  - shiprocket-fulfillment: Order fulfillment        │     │
│  └────────────────────────────────────────────────────┘     │
│                            │                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Amazon Bedrock                                     │     │
│  │  - Stable Diffusion XL / Titan Image Generator      │     │
│  └────────────────────────────────────────────────────┘     │
│                            │                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  S3 Bucket                                          │     │
│  │  - Generated design storage                         │     │
│  │  - Uploaded image storage                           │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Shiprocket Platform                         │
│  - Order Creation                                            │
│  - Fulfillment Management                                    │
│  - Shipping & Tracking                                       │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Design Generation Flow

1. **Customer Input**
   - Customer enters mood text or uploads image
   - Frontend validates input
   - Shows loading/progress indicator

2. **API Request**
   - POST to API Gateway `/generate-design`
   - Payload: `{ prompt: "happy summer vibes", productType: "tshirt" }`
   - Or: `{ imageUrl: "...", productType: "mug" }`

3. **Lambda Processing**
   - Validate request
   - Call Bedrock API with optimized prompt
   - Wait for image generation (async)
   - Upload result to S3
   - Return S3 URL

4. **Frontend Display**
   - Receive design URL
   - Display on product mockup
   - Allow customer to regenerate or proceed

5. **Add to Cart**
   - Store design URL in cart item properties
   - Proceed to checkout

### Order Fulfillment Flow

1. **Order Created**
   - Shopify webhook: `orders/create`
   - Lambda receives order data

2. **Process Order**
   - Extract design URL from order metafields
   - Validate design exists in S3
   - Prepare print specifications

3. **Create Shiprocket Order**
   - Map Shopify order to Shiprocket format
   - Include design URL and print specs
   - Send to Shiprocket API

4. **Track Fulfillment**
   - Poll Shiprocket for status updates
   - Update Shopify order status
   - Notify customer of shipment

## Component Responsibilities

### Frontend (Shopify Theme)
- User interface and experience
- Input validation
- Design preview rendering
- Product customization
- Cart management

### Backend (AWS Lambda)
- Business logic
- API orchestration
- Image generation coordination
- Webhook processing
- Error handling and retries

### Amazon Bedrock
- AI image generation
- Prompt processing
- Content moderation

### S3 Storage
- Design image persistence
- Uploaded image storage
- Static asset hosting

### Shopify
- E-commerce functionality
- Order management
- Customer data
- Payment processing

### Shiprocket
- Order fulfillment
- Shipping logistics
- Tracking updates

## Scalability Considerations

### Horizontal Scaling
- Lambda auto-scales with demand
- API Gateway handles traffic spikes
- S3 scales automatically

### Performance Optimization
- CDN for static assets (CloudFront)
- Image optimization and compression
- Lazy loading for design previews
- Caching frequently generated designs

### Reliability
- Retry logic for failed API calls
- Dead letter queues for failed webhooks
- Health checks and monitoring
- Graceful degradation

## Monitoring & Observability

### Metrics to Track
- Design generation success rate
- Average generation time
- API response times
- Order fulfillment rate
- Error rates by component

### Logging
- CloudWatch Logs for Lambda functions
- API Gateway access logs
- Bedrock API call logs
- Shopify webhook logs

### Alerts
- High error rates
- Slow response times
- Failed order processing
- S3 storage limits
- Cost thresholds exceeded

## Deployment Strategy

### Environments
- **Development**: Local theme development + AWS dev account
- **Staging**: Shopify development store + AWS staging
- **Production**: Live Shopify store + AWS production

### CI/CD Pipeline
1. Code commit to Git
2. Run tests and linting
3. Deploy Lambda functions (staging)
4. Deploy Shopify theme (staging)
5. Run integration tests
6. Manual approval
7. Deploy to production

### Rollback Plan
- Keep previous Lambda versions
- Shopify theme version control
- Database/S3 backups
- Feature flags for gradual rollout
