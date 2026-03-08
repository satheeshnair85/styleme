# AI Merchandise Platform - CloudFormation Deployment

Complete AWS infrastructure deployment using CloudFormation for the AI-powered custom merchandise platform.

## 🏗️ What Gets Deployed

### AWS Resources Created:
- **Lambda Function** - Python-based AI image generation
- **API Gateway** - REST API with CORS support
- **S3 Buckets** (2) - Anonymous and user image storage
- **IAM Roles & Policies** - Secure access permissions
- **CloudWatch Logs** - Function logging and monitoring
- **CloudWatch Alarms** - Error and performance monitoring

### Infrastructure Features:
- ✅ **Complete rollback capability** - Delete entire stack with one command
- ✅ **Environment separation** - dev/staging/prod configurations
- ✅ **Automatic S3 lifecycle** - Cost optimization with archiving
- ✅ **CORS configuration** - Shopify domain integration
- ✅ **Monitoring & Alarms** - Production-ready observability
- ✅ **Security best practices** - Least privilege IAM policies

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials
aws configure

# Install Python dependencies
pip install boto3 botocore
```

### 2. Deploy Everything
```bash
# Interactive management
python cloudformation/manage.py

# Or direct deployment
python cloudformation/deploy.py
```

### 3. Test the API
```bash
# Get the API endpoint from deployment output
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/generate-design \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: your-api-key' \
  -d '{"prompt": "cute cat wearing sunglasses", "productType": "tshirt"}'
```

## 📋 Management Commands

### Deploy Stack
```bash
python cloudformation/deploy.py --action deploy --environment dev
```

### Update Lambda Code Only
```bash
python cloudformation/deploy.py --action update-code
```

### Delete Stack (Complete Rollback)
```bash
python cloudformation/deploy.py --action delete --stack-name ai-merchandise-platform-dev
```

### Check Status
```bash
aws cloudformation describe-stacks --stack-name ai-merchandise-platform-dev
```

## 🔧 Configuration

### Environment Variables (from .env)
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# API Authentication
API_KEY=sk-ai-merchandise-2024-secure-key-xyz789

# Shopify Configuration
SHOPIFY_STORE_URL=stylemytravel-dev.myshopify.com
```

### CloudFormation Parameters
- `Environment` - dev/staging/prod
- `ApiKeyValue` - API authentication key
- `ShopifyDomain` - CORS allowed domain

## 🪣 S3 Bucket Structure

### Anonymous Users
```
ai-merchandise-anonymous-dev-123456789/
├── anonymous/
│   ├── tshirt/
│   │   └── 20240304_143022_uuid.png
│   ├── mug/
│   └── cap/
```

### Logged-in Users
```
ai-merchandise-users-dev-123456789/
├── user123/
│   ├── tshirt/
│   │   └── 20240304_143022_uuid.png
│   └── designs/
├── user456/
```

## 📊 Monitoring & Logs

### CloudWatch Logs
```bash
# View Lambda logs
aws logs tail /aws/lambda/ai-merchandise-design-generator-dev --follow

# View API Gateway logs
aws logs tail API-Gateway-Execution-Logs_your-api-id/dev --follow
```

### CloudWatch Alarms
- **Lambda Errors** - Triggers when >5 errors in 5 minutes
- **Lambda Duration** - Triggers when >4 minutes execution time
- **API Gateway 4XX/5XX** - HTTP error monitoring

## 💰 Cost Optimization

### S3 Lifecycle Policies
- **Anonymous images** - Deleted after 30 days
- **User images** - Archived to IA after 90 days, Glacier after 1 year

### Lambda Optimization
- Memory: 1024 MB (optimal for image processing)
- Timeout: 5 minutes (sufficient for Bedrock calls)
- Runtime: Python 3.11 (latest supported)

## 🔒 Security Features

### IAM Policies
- **Least privilege** - Only required permissions
- **Resource-specific** - Scoped to created buckets only
- **No wildcard permissions** - Explicit resource ARNs

### API Security
- **API Key authentication** - Prevents unauthorized access
- **CORS restrictions** - Only Shopify domain allowed
- **Request validation** - Input sanitization in Lambda

### S3 Security
- **Private buckets** - No public access
- **Presigned URLs** - Temporary access (1 hour)
- **Encryption at rest** - Default S3 encryption

## 🚨 Troubleshooting

### Common Issues

**1. Stack Creation Failed**
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name ai-merchandise-platform-dev

# Common causes:
# - IAM permissions insufficient
# - S3 bucket name already exists
# - API Gateway limits reached
```

**2. Lambda Function Errors**
```bash
# Check function logs
aws logs tail /aws/lambda/ai-merchandise-design-generator-dev

# Common causes:
# - Missing environment variables
# - Bedrock model not available in region
# - S3 bucket permissions
```

**3. API Gateway CORS Issues**
```bash
# Test CORS preflight
curl -X OPTIONS https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/generate-design \
  -H "Origin: https://stylemytravel-dev.myshopify.com" \
  -H "Access-Control-Request-Method: POST"
```

### Recovery Commands

**Complete Rollback**
```bash
# Delete everything and start fresh
python cloudformation/deploy.py --action delete
# Wait for completion, then redeploy
python cloudformation/deploy.py --action deploy
```

**Partial Recovery**
```bash
# Update only Lambda code
python cloudformation/deploy.py --action update-code

# Update stack configuration
python cloudformation/deploy.py --action deploy
```

## 📈 Scaling Considerations

### Production Deployment
```bash
# Deploy to production environment
python cloudformation/deploy.py --environment prod --stack-name ai-merchandise-platform-prod
```

### Multi-Region Deployment
- Modify template to include multiple regions
- Use CloudFormation StackSets for cross-region deployment
- Consider data residency requirements

### High Availability
- API Gateway is automatically multi-AZ
- Lambda is automatically distributed
- S3 has 99.999999999% durability
- Consider CloudFront for global distribution

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy AI Merchandise Platform
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to AWS
        run: python cloudformation/deploy.py --environment prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

This CloudFormation approach gives you complete infrastructure as code with easy rollback capabilities!