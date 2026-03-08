# Integration Guidelines

## Amazon Bedrock Integration

### Image Generation Flow
1. Customer submits text prompt or uploads image
2. Frontend validates input and shows loading state
3. Request sent to backend Lambda function
4. Lambda calls Bedrock API with appropriate model
5. Generated image stored in S3
6. Image URL returned to frontend
7. Customer previews design on selected product

### Best Practices
- Use appropriate Bedrock models (Stable Diffusion XL, Titan Image Generator)
- Implement prompt engineering for better results
- Set reasonable timeouts (30-60 seconds for generation)
- Handle rate limits and throttling
- Cache similar prompts to reduce costs
- Validate image dimensions for print quality (minimum 300 DPI)

### Error Handling
- Content policy violations: Show user-friendly message
- Generation timeout: Offer retry option
- Invalid prompts: Provide suggestions for improvement
- Service unavailable: Queue request or show maintenance message

## Shopify Integration

### Custom Product Flow
1. Customer configures product (type, size, color)
2. AI generates design based on mood/image
3. Design attached to product as custom attribute
4. Product added to cart with design metadata
5. Order placed with design reference
6. Webhook triggers fulfillment process

### Metafields Usage
- Store design S3 URL in order metafields
- Track generation parameters (prompt, model used)
- Link customer to their design history
- Store print specifications (size, position, color mode)

### Webhooks to Implement
- `orders/create`: Trigger Shiprocket fulfillment
- `orders/updated`: Sync status changes
- `products/create`: Initialize custom product settings
- `app/uninstalled`: Cleanup resources

## Shiprocket Integration

### Fulfillment Flow
1. Shopify order webhook received
2. Extract order details and design URL
3. Create Shiprocket order with custom print instructions
4. Download design from S3
5. Send to print partner with product details
6. Track shipment status
7. Update Shopify order with tracking info

### Order Mapping
```javascript
{
  shopifyOrderId: "12345",
  shiprocketOrderId: "SR-67890",
  designUrl: "s3://bucket/design-uuid.png",
  productType: "tshirt",
  printSpecs: {
    position: "front",
    size: "A4",
    colorMode: "CMYK"
  }
}
```

### Status Sync
- Map Shiprocket statuses to Shopify fulfillment states
- Update customer with tracking information
- Handle cancellations and returns
- Notify on delivery confirmation

## Security Considerations

### API Keys
- Store all credentials in environment variables
- Use AWS Secrets Manager for production
- Rotate keys regularly
- Implement least-privilege access

### Data Privacy
- Don't store customer prompts longer than necessary
- Anonymize uploaded images after processing
- Comply with GDPR/data protection regulations
- Provide data deletion on request

### Rate Limiting
- Implement rate limiting on AI generation endpoints
- Prevent abuse with CAPTCHA or authentication
- Monitor usage patterns for anomalies
- Set per-customer generation limits

## Cost Optimization

### Bedrock Usage
- Cache common prompts and results
- Use lower-cost models for previews
- Implement batch processing where possible
- Monitor token usage and costs

### S3 Storage
- Implement lifecycle policies (delete after 90 days)
- Use S3 Intelligent-Tiering
- Compress images without quality loss
- Clean up failed/abandoned designs

### API Calls
- Batch Shopify API requests
- Use GraphQL to reduce over-fetching
- Cache product data locally
- Implement exponential backoff for retries
