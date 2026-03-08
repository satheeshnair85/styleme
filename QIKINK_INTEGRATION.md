# Qikink API Integration Guide

## Overview

This document describes the integration between your Shopify store and Qikink's print-on-demand fulfillment service. The integration allows automatic order creation in Qikink when customers place orders with AI-generated designs.

## Architecture

```
Shopify Order (with AI design) 
    ↓
Shopify Webhook (orders/create)
    ↓
AWS Lambda (order-processor)
    ↓
Qikink API (create order with design_link from S3)
    ↓
Qikink Fulfillment (printing & shipping)
```

## API Configuration

### Sandbox Environment
- **Base URL**: `https://sandbox.qikink.com`
- **Client ID**: `822874727463386`
- **Access Token**: Provided (JWT token, expires after ~1 hour)

### Production Environment
- **Base URL**: `https://api.qikink.com` (to be confirmed)
- **Client ID**: TBD
- **Access Token**: TBD

## API Endpoints

### 1. Create Order
**Endpoint**: `POST /api/order/create`

**Headers**:
```
ClientId: your-client-id
Accesstoken: your-access-token
Content-Type: application/json
```

**Request Body**:
```json
{
  "order_number": "SHOP12345",
  "qikink_shipping": "1",
  "gateway": "COD",
  "total_order_value": "299",
  "line_items": [
    {
      "search_from_my_products": 0,
      "quantity": "1",
      "print_type_id": 1,
      "price": "299",
      "sku": "MVnHs-Wh-S",
      "designs": [
        {
          "design_code": "DESIGN123",
          "width_inches": "",
          "height_inches": "",
          "placement_sku": "fr",
          "design_link": "https://your-s3-bucket.s3.amazonaws.com/design.png",
          "mockup_link": "https://your-s3-bucket.s3.amazonaws.com/mockup.png"
        }
      ]
    }
  ],
  "shipping_address": {
    "first_name": "John",
    "last_name": "Doe",
    "address1": "123 Main Street",
    "phone": "9876543210",
    "email": "john@example.com",
    "city": "Mumbai",
    "zip": "400001",
    "province": "Maharashtra",
    "country_code": "IN"
  }
}
```

**Response** (Success):
```json
{
  "message": "Order created successfully",
  "order_id": 7451136,
  "status_code": "200"
}
```

**Response** (Error):
```json
{
  "error": "Error message",
  "status_code": "400"
}
```

### 2. Get Order Status
**Endpoint**: `GET /api/order?id={order_id}`

**Headers**: Same as create order

**Response**:
```json
{
  "order_id": "SHOP12345",
  "qikink_order_id": 7451136,
  "status": "processing",
  "tracking_number": "TRACK123",
  "tracking_url": "https://tracking.url"
}
```

### 3. Get Orders by Date Range
**Endpoint**: `GET /api/order?from_date=01.01.2024&to_date=31.01.2024`

**Date Format**: `DD.MM.YYYY`

## Important Constraints

1. **Order Number**:
   - Maximum 15 characters
   - No special characters allowed (only alphanumeric)
   - Example: `SHOP12345`, `API91400`

2. **Design URLs**:
   - Must be publicly accessible (S3 objects need `public-read` ACL)
   - Qikink downloads the design from the URL
   - Both `design_link` and `mockup_link` are required

3. **SKU Mapping**:
   - Each Shopify product must be mapped to a Qikink SKU
   - Example: `MVnHs-Wh-S` = White T-Shirt, Size S
   - Get SKU list from Qikink dashboard or API

4. **Print Types**:
   - `print_type_id: 1` = DTG (Direct to Garment)
   - `print_type_id: 2` = Sublimation
   - Confirm with Qikink for complete list

5. **Placement SKUs**:
   - `fr` = Front
   - `bk` = Back
   - `ls` = Left Sleeve
   - `rs` = Right Sleeve

## Implementation Files

### 1. Qikink Client (`backend/src/utils/qikink-client.ts`)
TypeScript client for Qikink API with:
- Authentication handling
- Order creation
- Order status checking
- Design URL validation

### 2. Test Script (`backend/src/scripts/test-qikink-api.ts`)
Test script to verify API integration:
```bash
npx ts-node src/scripts/test-qikink-api.ts
```

### 3. Environment Variables (`.env`)
```bash
QIKINK_API_URL=https://sandbox.qikink.com
QIKINK_CLIENT_ID=822874727463386
QIKINK_ACCESS_TOKEN=your-token-here
```

## Integration Flow

### Step 1: Customer Places Order
1. Customer customizes product with AI design
2. Design is generated and stored in S3
3. Design URL is attached to cart item properties
4. Customer completes checkout

### Step 2: Shopify Webhook Triggered
1. Shopify sends `orders/create` webhook to Lambda
2. Lambda extracts:
   - Order details
   - Customer shipping address
   - Design URL from order metafields
   - Product SKU

### Step 3: Create Qikink Order
1. Lambda maps Shopify order to Qikink format
2. Calls Qikink API with:
   - Order number (Shopify order ID)
   - Line items with design URLs
   - Shipping address
3. Qikink returns order ID

### Step 4: Store Qikink Order ID
1. Lambda updates Shopify order metafields with Qikink order ID
2. This allows tracking and status sync

### Step 5: Fulfillment
1. Qikink downloads design from S3
2. Prints product
3. Ships to customer
4. Updates tracking information

## S3 Configuration for Design URLs

Designs must be publicly accessible for Qikink to download them:

### Option 1: Public-Read ACL (Per Object)
```typescript
await s3.putObject({
  Bucket: 'ai-custom-merchandise-designs',
  Key: `designs/${orderId}/${designId}.png`,
  Body: imageBuffer,
  ContentType: 'image/png',
  ACL: 'public-read',  // Makes this object publicly readable
});
```

### Option 2: Bucket Policy (All Objects)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ai-custom-merchandise-designs/designs/*"
    }
  ]
}
```

## Product SKU Mapping

You need to map your Shopify products to Qikink SKUs. Example:

```typescript
const QIKINK_SKU_MAPPING = {
  'custom-ai-t-shirt': {
    'S-Black': 'MVnHs-Bl-S',
    'S-White': 'MVnHs-Wh-S',
    'M-Black': 'MVnHs-Bl-M',
    'M-White': 'MVnHs-Wh-M',
    // ... more variants
  },
  'custom-ai-mug': {
    'Standard-White': 'MUG-Wh-11OZ',
  },
  // ... more products
};
```

## Testing Checklist

- [x] API authentication works
- [x] Order creation successful (Order ID: 7451136)
- [ ] Design URL is accessible from S3
- [ ] Order status retrieval works
- [ ] Shopify webhook triggers Lambda
- [ ] Lambda creates Qikink order
- [ ] Qikink order ID stored in Shopify
- [ ] End-to-end flow tested

## Next Steps

1. **Get Production Credentials**
   - Contact Qikink for production API access
   - Update `.env` with production credentials

2. **Get Complete SKU List**
   - Export product catalog from Qikink dashboard
   - Create SKU mapping for all products

3. **Update Order Processor Lambda**
   - Integrate Qikink client into `order-processor.ts`
   - Map Shopify orders to Qikink format
   - Handle errors and retries

4. **Configure S3 Bucket**
   - Make design URLs publicly accessible
   - Set up lifecycle policies for cleanup

5. **Test End-to-End**
   - Place test order in Shopify
   - Verify Qikink order creation
   - Check fulfillment status

6. **Deploy to Production**
   - Update Lambda environment variables
   - Deploy updated code
   - Monitor for errors

## Support

- **Qikink API Documentation**: https://documenter.getpostman.com/view/26157218/2sB3QKqpma
- **Qikink Support**: Contact through dashboard
- **Sandbox Testing**: Use provided credentials above

## Notes

- Access tokens expire (JWT tokens typically last 1 hour)
- Implement token refresh mechanism for production
- Monitor Qikink API rate limits
- Keep design files in S3 for at least 90 days (order fulfillment window)
