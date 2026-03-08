# AWS Architecture Diagram - AI Custom Merchandise

## Visual Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Customer Browser - 4-Step Workflow                                 │    │
│  │  Step 1: Mood Input → Step 2: 3 AI Designs → Step 3: Products →    │    │
│  │  Step 4: Design Preview & Application                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTPS/REST API
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SHOPIFY PLATFORM                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Shopify Store + Qikink App Integration                             │    │
│  │  • Product Catalog Sync                                             │    │
│  │  • Order Management & Metafields                                    │    │
│  │  • Webhook Processing                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ API Calls & Webhooks
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUD                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          PUBLIC SUBNET                               │    │
│  │  ┌─────────────────┐              ┌─────────────────┐                │    │
│  │  │  API Gateway    │              │   CloudFront    │                │    │
│  │  │  REST Endpoints │              │      CDN        │                │    │
│  │  │  • /generate-   │              │   (S3 Assets)   │                │    │
│  │  │    designs      │              │                 │                │    │
│  │  │  • /apply-      │              │                 │                │    │
│  │  │    design       │              │                 │                │    │
│  │  │  • /products    │              │                 │                │    │
│  │  └─────────────────┘              └─────────────────┘                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         PRIVATE SUBNET                               │    │
│  │                                                                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    │
│  │  │ Design Generator│  │ Qikink Integrator│  │ Order Processor │      │    │
│  │  │     Lambda      │  │     Lambda      │  │     Lambda      │      │    │
│  │  │                 │  │                 │  │                 │      │    │
│  │  │ • Generate 3    │  │ • Product Sync  │  │ • Webhook       │      │    │
│  │  │   variations    │  │ • API Calls     │  │   Processing    │      │    │
│  │  │ • Store in S3   │  │ • Design Apply  │  │ • Order Meta    │      │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │    │
│  │           │                     │                     │              │    │
│  │           ▼                     ▼                     ▼              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    │
│  │  │ Amazon Bedrock  │  │   S3 Storage    │  │   DynamoDB      │      │    │
│  │  │                 │  │                 │  │                 │      │    │
│  │  │ • Stable        │  │ • Design Images │  │ • Session Data  │      │    │
│  │  │   Diffusion XL  │  │ • Thumbnails    │  │ • Design Meta   │      │    │
│  │  │ • 3 Design      │  │ • Uploaded      │  │ • Product Cache │      │    │
│  │  │   Variations    │  │   Images        │  │                 │      │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │    │
│  │                                                                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    │
│  │  │   CloudWatch    │  │ Secrets Manager │  │   EventBridge   │      │    │
│  │  │                 │  │                 │  │                 │      │    │
│  │  │ • Monitoring    │  │ • API Keys      │  │ • Webhook       │      │    │
│  │  │ • Logs          │  │ • Credentials   │  │   Routing       │      │    │
│  │  │ • Alerts        │  │                 │  │                 │      │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ API Integration
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QIKINK PLATFORM                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Print-on-Demand Services                                           │    │
│  │  • Product Catalog API                                              │    │
│  │  • Custom Design Application API                                    │    │
│  │  • Order Fulfillment & Tracking                                     │    │
│  │  • Shipping Integration                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Patterns

### 🔄 Design Generation Flow
```
Customer Input → API Gateway → Design Generator Lambda → Amazon Bedrock → 
Generate 3 Variations → Store in S3 → Return URLs → Display to Customer
```

### 🛒 Order Processing Flow
```
Shopify Order → Webhook → EventBridge → Order Processor Lambda → 
Extract Design Metadata → Qikink API → Fulfillment
```

### 📦 Product Sync Flow
```
Qikink Catalog → Qikink Integrator Lambda → DynamoDB Cache → 
Shopify Product Updates → Customer Product Selection
```

## Service Responsibilities

| Service | Purpose | Key Functions |
|---------|---------|---------------|
| **API Gateway** | Entry point for all API calls | Rate limiting, authentication, routing |
| **Design Generator Lambda** | AI image generation | Bedrock integration, 3 design variations, S3 storage |
| **Qikink Integrator Lambda** | External API management | Product sync, design application, order creation |
| **Order Processor Lambda** | Webhook handling | Order validation, metadata extraction, fulfillment trigger |
| **Amazon Bedrock** | AI/ML service | Stable Diffusion XL model, content moderation |
| **S3** | Object storage | Design images, thumbnails, uploaded files |
| **DynamoDB** | NoSQL database | Session management, design metadata, product cache |
| **CloudWatch** | Monitoring | Logs, metrics, alerts, performance tracking |
| **Secrets Manager** | Credential management | API keys, database credentials, certificates |
| **EventBridge** | Event routing | Webhook processing, async communication |

## Security & Networking

### Network Architecture
- **Public Subnet**: API Gateway, CloudFront (internet-facing)
- **Private Subnet**: Lambda functions, databases, AI services (internal only)
- **VPC**: Isolated network environment with security groups

### Security Measures
- **IAM Roles**: Least privilege access for all services
- **API Authentication**: JWT tokens, API keys
- **Data Encryption**: At rest (S3, DynamoDB) and in transit (HTTPS)
- **Content Filtering**: Bedrock built-in moderation
- **Rate Limiting**: API Gateway throttling

## Scalability & Performance

### Auto-Scaling Components
- **Lambda Functions**: Automatic scaling based on demand
- **API Gateway**: Handles traffic spikes automatically  
- **DynamoDB**: On-demand scaling
- **S3**: Unlimited storage capacity

### Performance Optimizations
- **CloudFront CDN**: Global content delivery
- **Parallel Processing**: 3 designs generated simultaneously
- **Caching**: DynamoDB for product data, browser cache for assets
- **Async Processing**: Non-blocking design generation

## Cost Optimization

### Pay-per-Use Services
- **Lambda**: Pay per execution
- **Bedrock**: Pay per AI generation
- **API Gateway**: Pay per request
- **S3**: Pay per storage and transfer

### Cost Controls
- **Lifecycle Policies**: Auto-delete old designs (90 days)
- **Intelligent Tiering**: S3 automatic cost optimization
- **Reserved Capacity**: For predictable workloads
- **Monitoring**: CloudWatch cost alerts

This architecture provides a robust, scalable, and cost-effective solution for the AI-powered custom merchandise platform with clear separation of concerns and optimal performance characteristics.