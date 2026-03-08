# Design Document

## Introduction

This document provides the technical design for an AI-powered custom merchandise e-commerce platform built on Shopify. The system implements a 4-step workflow where customers create personalized products by inputting their mood or uploading images, which are processed through Amazon Bedrock to generate multiple design options. The platform operates as a pure dropshipping model, integrating with Qikink for automated print-on-demand fulfillment.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Customer Browser                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Shopify Storefront (4-Step Workflow)              │     │
│  │  Step 1: Mood Input → Step 2: Design Selection     │     │
│  │  Step 3: Product Selection → Step 4: Preview       │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Shopify Platform                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Shopify Store + Qikink App Integration            │     │
│  │  - Product Catalog Sync                            │     │
│  │  - Order Management                                 │     │
│  │  - Metafields for Design Storage                    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  API Gateway                                        │     │
│  │  - /generate-designs (POST) - Creates 3 designs    │     │
│  │  - /upload-image (POST) - Handles image uploads    │     │
│  │  - /apply-design (POST) - Qikink API integration   │     │
│  └────────────────────────────────────────────────────┘     │
│                            │                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Lambda Functions                                   │     │
│  │  - design-generator: Multi-design AI generation    │     │
│  │  - qikink-integrator: Product catalog & API calls  │     │
│  │  - order-processor: Webhook handling               │     │
│  └────────────────────────────────────────────────────┘     │
│                            │                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Amazon Bedrock                                     │     │
│  │  - Stable Diffusion XL for 3 design variations     │     │
│  └────────────────────────────────────────────────────┘     │
│                            │                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  S3 Bucket                                          │     │
│  │  - Generated designs (3 per session)               │     │
│  │  - Uploaded inspiration images                      │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Qikink Platform                             │
│  - Product Catalog API                                       │
│  - Custom Design Application API                             │
│  - Order Fulfillment & Tracking                             │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Frontend Components (Shopify Liquid + JavaScript)

#### 1.1 Multi-Step Workflow Manager
```javascript
class WorkflowManager {
  constructor() {
    this.currentStep = 1;
    this.sessionData = {
      moodInput: null,
      uploadedImage: null,
      generatedDesigns: [],
      selectedDesign: null,
      selectedProduct: null,
      selectedVariant: null
    };
  }

  // Navigate between steps with validation
  nextStep() { /* Implementation */ }
  previousStep() { /* Implementation */ }
  validateStep(stepNumber) { /* Implementation */ }
}
```

#### 1.2 Step Components

**Step 1: Mood Input Component**
- Text input with character validation (3-500 chars)
- Image upload with drag-and-drop support
- File validation (PNG, JPEG, WebP, max 10MB)
- Mobile camera access integration
- Style suggestion tags for inspiration

**Step 2: Design Selection Component**
- Display 3 AI-generated design variations
- Design selection interface with preview
- Regenerate all designs functionality
- Loading states and progress indicators

**Step 3: Product Catalog Component**
- Qikink product grid with filtering
- Product variant selection (size, color)
- Pricing display with markup calculation
- Product specifications and size charts

**Step 4: Design Preview Component**
- Product mockup with design overlay
- Accurate print area positioning
- Final review and cart addition
- Navigation back to previous steps

### 2. Backend Services (AWS Lambda)

#### 2.1 Design Generator Service
```python
class DesignGenerator:
    def __init__(self):
        self.bedrock_client = BedrockClient()
        self.s3_client = S3Client()
    
    def generate_multiple_designs(self, input_data):
        """Generate 3 design variations from single input"""
        designs = []
        base_prompt = self.process_input(input_data)
        
        # Create 3 variations with different style modifiers
        variations = [
            f"{base_prompt}, vibrant and bold style",
            f"{base_prompt}, minimalist and clean style", 
            f"{base_prompt}, artistic and creative style"
        ]
        
        for i, prompt in enumerate(variations):
            design_url = self.generate_single_design(prompt)
            designs.append({
                'id': f"design_{i+1}",
                'url': design_url,
                'prompt': prompt,
                'style': ['vibrant', 'minimalist', 'artistic'][i]
            })
        
        return designs
```

#### 2.2 Qikink Integration Service
```python
class QikinkIntegrator:
    def __init__(self):
        self.qikink_api = QikinkAPIClient()
        self.product_cache = ProductCache()
    
    def sync_product_catalog(self):
        """Sync Qikink products to Shopify"""
        products = self.qikink_api.get_products()
        return self.update_shopify_products(products)
    
    def apply_design_to_product(self, design_url, product_sku, specifications):
        """Apply custom design via Qikink API"""
        return self.qikink_api.create_custom_product(
            design_url=design_url,
            product_sku=product_sku,
            print_specs=specifications
        )
```

### 3. Data Models

#### 3.1 Session Data Structure
```json
{
  "sessionId": "uuid",
  "step": 1,
  "timestamp": "2024-02-15T10:30:00Z",
  "moodInput": {
    "type": "text|image",
    "content": "happy summer vibes with palm trees",
    "imageUrl": "s3://bucket/uploaded-image.jpg"
  },
  "generatedDesigns": [
    {
      "id": "design_1",
      "url": "s3://bucket/design-1-uuid.png",
      "style": "vibrant",
      "prompt": "happy summer vibes with palm trees, vibrant and bold style"
    },
    {
      "id": "design_2", 
      "url": "s3://bucket/design-2-uuid.png",
      "style": "minimalist",
      "prompt": "happy summer vibes with palm trees, minimalist and clean style"
    },
    {
      "id": "design_3",
      "url": "s3://bucket/design-3-uuid.png", 
      "style": "artistic",
      "prompt": "happy summer vibes with palm trees, artistic and creative style"
    }
  ],
  "selectedDesign": "design_2",
  "selectedProduct": {
    "qikinkSku": "TSHIRT-COTTON-001",
    "shopifyId": "12345",
    "type": "t-shirt",
    "variant": {
      "size": "M",
      "color": "white",
      "price": 599
    }
  }
}
```

#### 3.2 Design Metadata Structure
```json
{
  "designId": "uuid",
  "s3Url": "https://s3.amazonaws.com/bucket/design-uuid.png",
  "originalPrompt": "happy summer vibes",
  "generatedPrompt": "happy summer vibes with palm trees, vibrant style",
  "bedrockModel": "stability.stable-diffusion-xl-v1",
  "generationTime": "2024-02-15T10:30:00Z",
  "specifications": {
    "width": 3000,
    "height": 3000,
    "dpi": 300,
    "format": "PNG",
    "colorMode": "RGB"
  },
  "qikinkSpecs": {
    "printArea": "12x16 inches",
    "placement": "front-center",
    "printMethod": "DTG"
  }
}
```

## API Design

### 1. Design Generation API

**POST /api/generate-designs**
```json
{
  "input": {
    "type": "text|image",
    "content": "happy summer vibes with palm trees",
    "imageUrl": "optional-s3-url"
  },
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "designs": [
    {
      "id": "design_1",
      "url": "s3://bucket/design-1.png",
      "style": "vibrant",
      "thumbnail": "s3://bucket/design-1-thumb.png"
    },
    {
      "id": "design_2", 
      "url": "s3://bucket/design-2.png",
      "style": "minimalist",
      "thumbnail": "s3://bucket/design-2-thumb.png"
    },
    {
      "id": "design_3",
      "url": "s3://bucket/design-3.png",
      "style": "artistic", 
      "thumbnail": "s3://bucket/design-3-thumb.png"
    }
  ],
  "sessionId": "uuid"
}
```

### 2. Product Catalog API

**GET /api/products**
```json
{
  "success": true,
  "products": [
    {
      "qikinkSku": "TSHIRT-COTTON-001",
      "shopifyId": "12345",
      "name": "Cotton T-Shirt",
      "type": "t-shirt",
      "basePrice": 399,
      "variants": [
        {
          "size": "S",
          "color": "white",
          "available": true,
          "price": 399
        }
      ],
      "printSpecs": {
        "maxPrintArea": "12x16 inches",
        "supportedPlacements": ["front", "back"],
        "printMethods": ["DTG", "vinyl"]
      }
    }
  ]
}
```

### 3. Design Application API

**POST /api/apply-design**
```json
{
  "designId": "design_2",
  "productSku": "TSHIRT-COTTON-001",
  "variant": {
    "size": "M",
    "color": "white"
  },
  "placement": "front-center",
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "previewUrl": "s3://bucket/preview-mockup.png",
  "qikinkProductId": "QK-12345",
  "shopifyVariantId": "67890",
  "pricing": {
    "basePrice": 399,
    "designFee": 200,
    "totalPrice": 599
  }
}
```

## Database Design

### 1. Session Storage (DynamoDB)
```
Table: design_sessions
- sessionId (String, Primary Key)
- step (Number)
- createdAt (String)
- expiresAt (String, TTL)
- moodInput (Map)
- generatedDesigns (List)
- selectedDesign (String)
- selectedProduct (Map)
```

### 2. Design Storage (DynamoDB)
```
Table: generated_designs
- designId (String, Primary Key)
- sessionId (String, GSI)
- s3Url (String)
- metadata (Map)
- createdAt (String)
- associatedOrderId (String, Optional)
```

### 3. Product Cache (DynamoDB)
```
Table: qikink_products
- qikinkSku (String, Primary Key)
- shopifyId (String)
- productData (Map)
- lastSyncAt (String)
- available (Boolean)
```

## Integration Patterns

### 1. Qikink Integration Flow

```
1. Product Sync (Scheduled):
   Lambda → Qikink API → Get Products → Update Shopify → Cache in DynamoDB

2. Design Application (Real-time):
   Frontend → API Gateway → Lambda → Qikink API → Apply Design → Return Preview

3. Order Processing (Webhook):
   Shopify → Webhook → Lambda → Extract Design Metadata → Qikink Fulfillment
```

### 2. Error Handling Strategy

**Retry Logic:**
- Bedrock API: 3 retries with exponential backoff
- Qikink API: 5 retries with circuit breaker pattern
- S3 Operations: 2 retries with immediate retry

**Fallback Mechanisms:**
- Bedrock unavailable: Show cached example designs
- Qikink API down: Queue requests for later processing
- S3 issues: Use CloudFront cached versions

### 3. Caching Strategy

**Frontend Caching:**
- Product catalog: 1 hour browser cache
- Generated designs: Session storage until completion
- Static assets: 24 hour cache with service worker

**Backend Caching:**
- Qikink products: 6 hour DynamoDB cache
- Design thumbnails: CloudFront CDN
- API responses: 5 minute ElastiCache for repeated requests

## Security Considerations

### 1. Input Validation
- Sanitize all text prompts for injection attacks
- Validate image file types and scan for malware
- Rate limiting: 10 design generations per IP per hour
- Content moderation via Bedrock built-in filters

### 2. API Security
- JWT tokens for session management
- API Gateway throttling and authentication
- Qikink API credentials in AWS Secrets Manager
- S3 bucket policies for design file access

### 3. Data Privacy
- Encrypt design files at rest (S3 AES-256)
- Automatic deletion of unused designs after 90 days
- GDPR compliance for EU customers
- No storage of sensitive customer data in logs

## Performance Optimization

### 1. Design Generation
- Parallel Bedrock calls for 3 designs (reduce from 60s to 20s)
- Async processing with WebSocket updates
- Pre-generate thumbnails for faster preview
- Compress images without quality loss

### 2. Frontend Performance
- Lazy loading for product images
- Progressive image loading with placeholders
- Debounced input validation
- Service worker for offline capability

### 3. Scalability
- Auto-scaling Lambda functions
- DynamoDB on-demand pricing
- CloudFront global distribution
- API Gateway regional endpoints

## Monitoring and Observability

### 1. Metrics to Track
- Design generation success rate (target: >95%)
- Average generation time (target: <30s for 3 designs)
- Step completion rates in workflow
- Qikink API response times
- Order conversion rate from design to purchase

### 2. Alerting
- High error rates (>5% in 5 minutes)
- Slow response times (>60s for design generation)
- Qikink API failures
- S3 storage approaching limits
- Cost thresholds exceeded

### 3. Logging
- Structured JSON logs in CloudWatch
- Request tracing with X-Ray
- Customer journey analytics
- Design generation parameters and outcomes

## Deployment Strategy

### 1. Infrastructure as Code
- AWS CDK for infrastructure deployment
- Separate stacks for dev/staging/production
- Automated rollback on deployment failures
- Blue-green deployment for Lambda functions

### 2. CI/CD Pipeline
```
1. Code Commit → GitHub Actions
2. Run Tests → Unit + Integration + E2E
3. Build Artifacts → Lambda packages + Frontend assets
4. Deploy to Staging → Automated testing
5. Manual Approval → Production deployment
6. Health Checks → Rollback if needed
```

### 3. Environment Management
- Development: Single region, minimal resources
- Staging: Production-like setup for testing
- Production: Multi-AZ, auto-scaling, monitoring

This design provides a robust, scalable foundation for the AI-powered custom merchandise platform with clear separation of concerns, comprehensive error handling, and optimal user experience through the 4-step workflow.
