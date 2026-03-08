# AWS Architecture - AI Custom Merchandise (Single Page)

## System Overview
**4-Step Customer Workflow**: Mood Input → Generate 3 AI Designs → Product Selection → Design Application

```
┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMER BROWSER                          │
│     Step 1: Mood → Step 2: 3 Designs → Step 3: Products        │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS/API
┌─────────────────────────▼───────────────────────────────────────┐
│                    SHOPIFY + QIKINK APP                         │
│        Product Catalog • Order Management • Webhooks           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ API Calls
┌─────────────────────────▼───────────────────────────────────────┐
│                        AWS CLOUD                                │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  API Gateway    │    │   CloudFront    │    │ EventBridge  │ │
│  │  REST Endpoints │    │      CDN        │    │   Webhooks   │ │
│  └─────────┬───────┘    └─────────────────┘    └──────────────┘ │
│            │                                                    │
│  ┌─────────▼───────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ Design Generator│    │ Qikink Integrator│   │Order Processor│ │
│  │     Lambda      │    │     Lambda      │    │    Lambda    │ │
│  │ • 3 Variations  │    │ • Product Sync  │    │ • Webhooks   │ │
│  └─────────┬───────┘    └─────────┬───────┘    └──────┬───────┘ │
│            │                      │                   │         │
│  ┌─────────▼───────┐    ┌─────────▼───────┐    ┌──────▼───────┐ │
│  │ Amazon Bedrock  │    │   S3 Storage    │    │  DynamoDB    │ │
│  │Stable Diffusion │    │ Design Images   │    │Session Data  │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   CloudWatch    │    │ Secrets Manager │    │              │ │
│  │ Logs & Metrics  │    │   API Keys      │    │              │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ API Integration
┌─────────────────────────▼───────────────────────────────────────┐
│                    QIKINK PLATFORM                              │
│     Product API • Design Application • Order Fulfillment       │
└─────────────────────────────────────────────────────────────────┘
```

## Key Data Flows

| Flow | Path | Purpose |
|------|------|---------|
| **Design Generation** | Customer → API Gateway → Lambda → Bedrock → S3 | Generate 3 AI design variations |
| **Order Processing** | Shopify → Webhook → Lambda → Qikink API | Automated fulfillment |
| **Product Sync** | Qikink → Lambda → DynamoDB → Shopify | Catalog synchronization |

## Core Services

| Service | Function | Key Features |
|---------|----------|--------------|
| **API Gateway** | Entry point | Rate limiting, authentication |
| **Lambda Functions** | Business logic | Auto-scaling, serverless compute |
| **Amazon Bedrock** | AI generation | Stable Diffusion XL, 3 variations |
| **S3** | Storage | Design images, thumbnails |
| **DynamoDB** | Database | Session data, metadata cache |
| **CloudWatch** | Monitoring | Logs, metrics, alerts |

## Architecture Benefits

### **Scalability**
- **Auto-scaling**: Lambda, API Gateway, DynamoDB scale automatically
- **Global CDN**: CloudFront for fast content delivery worldwide
- **Parallel Processing**: 3 designs generated simultaneously

### **Security**
- **Network Isolation**: VPC with public/private subnets
- **Encryption**: Data encrypted at rest (S3, DynamoDB) and in transit (HTTPS)
- **IAM Roles**: Least privilege access for all services
- **Content Moderation**: Bedrock built-in filters

### **Cost Optimization**
- **Pay-per-Use**: Lambda, Bedrock, API Gateway charge per request
- **Lifecycle Policies**: Auto-delete unused designs after 90 days
- **Intelligent Tiering**: S3 automatic cost optimization
- **Reserved Capacity**: For predictable workloads

### **Performance**
- **Sub-30s Generation**: 3 AI designs in under 30 seconds
- **CDN Caching**: Fast global asset delivery
- **Async Processing**: Non-blocking operations
- **Database Caching**: Product data cached in DynamoDB

## Integration Points

### **Shopify Integration**
- Native Qikink app handles product sync and basic fulfillment
- Order metafields store design URLs and specifications
- Webhooks trigger automated processing

### **Qikink Integration**
- Product catalog API for real-time inventory
- Custom design application API for print specifications
- Order fulfillment API for automated processing
- Tracking API for shipment updates

### **Monitoring & Alerts**
- CloudWatch tracks all service metrics and logs
- Alerts for high error rates, slow performance, cost thresholds
- Real-time monitoring of design generation success rates

**Total Services**: 8 AWS services + 2 external integrations (Shopify, Qikink)
**Estimated Monthly Cost**: $200-500 for 1000 orders (varies by usage)
**Performance Target**: <30s for 3 design generation, 99.9% uptime