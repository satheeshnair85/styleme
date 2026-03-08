# API Configuration Guide

## Design Generation API

The design generation UI requires a backend API endpoint to generate designs using Amazon Bedrock. This document explains how to configure the API endpoint.

### API Endpoint Configuration

The design generation JavaScript looks for the API base URL in the following order:

1. **Window variable**: `window.DESIGN_API_URL`
2. **Default placeholder**: `https://api-placeholder.example.com`

### Setting the API URL

#### Option 1: Theme Settings (Recommended for Production)

Add the API URL to your theme's settings:

1. Edit `config/settings_schema.json`
2. Add a new setting:

```json
{
  "name": "API Configuration",
  "settings": [
    {
      "type": "text",
      "id": "design_api_url",
      "label": "Design Generation API URL",
      "info": "The base URL for the design generation API (e.g., https://api.example.com)",
      "default": ""
    }
  ]
}
```

3. In `layout/theme.liquid`, add before the design-generation.js script:

```liquid
<script>
  window.DESIGN_API_URL = '{{ settings.design_api_url }}';
</script>
```

#### Option 2: Direct JavaScript Configuration (Development)

For development/testing, you can set the URL directly in `assets/design-generation.js`:

```javascript
var API_BASE_URL = 'https://your-api-gateway-url.amazonaws.com/prod';
```

### API Endpoint Requirements

The design generation API must implement the following endpoint:

#### POST /generate-design

**Request Format:**
```json
{
  "input": {
    "type": "text" | "image",
    "content": "mood description text" | "data:image/png;base64,..."
  },
  "productType": "tshirt" | "polo" | "mug" | "cap" | "sticker",
  "sessionId": "wf_abc123_xyz789"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "designs": [
      {
        "id": "design-uuid-1",
        "s3Url": "https://s3.amazonaws.com/bucket/designs/uuid-1.png",
        "thumbnailUrl": "https://s3.amazonaws.com/bucket/designs/uuid-1_thumb.png",
        "metadata": {
          "model": "stability.stable-diffusion-xl-v1",
          "generatedAt": "2024-01-15T10:30:00Z",
          "dimensions": { "width": 2048, "height": 2048, "dpi": 300 }
        }
      },
      {
        "id": "design-uuid-2",
        "s3Url": "https://s3.amazonaws.com/bucket/designs/uuid-2.png",
        "thumbnailUrl": "https://s3.amazonaws.com/bucket/designs/uuid-2_thumb.png",
        "metadata": { /* ... */ }
      },
      {
        "id": "design-uuid-3",
        "s3Url": "https://s3.amazonaws.com/bucket/designs/uuid-3.png",
        "thumbnailUrl": "https://s3.amazonaws.com/bucket/designs/uuid-3_thumb.png",
        "metadata": { /* ... */ }
      }
    ],
    "sessionId": "wf_abc123_xyz789",
    "generationTime": 45.2
  }
}
```

**Error Response (4xx/5xx):**
```json
{
  "success": false,
  "error": {
    "code": "CONTENT_POLICY_VIOLATION" | "TIMEOUT" | "INVALID_INPUT" | "SERVER_ERROR",
    "message": "User-friendly error message",
    "details": {}
  }
}
```

### Error Codes

The frontend handles the following error scenarios:

- **CONTENT_POLICY_VIOLATION**: Input violates content policy
- **TIMEOUT**: Generation exceeded 60 seconds
- **INVALID_INPUT**: Missing or invalid request parameters
- **SERVER_ERROR**: Internal server error
- **Network errors**: Connection failures, timeouts

### CORS Configuration

Ensure your API Gateway has CORS enabled for your Shopify store domain:

```
Access-Control-Allow-Origin: https://your-store.myshopify.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### Testing

For testing without a backend, you can mock the API response:

```javascript
// In assets/design-generation.js, replace the fetch call with:
setTimeout(function() {
  var mockDesigns = [
    {
      id: 'mock-1',
      s3Url: 'https://via.placeholder.com/512x512/6366f1/ffffff?text=Design+1',
      thumbnailUrl: 'https://via.placeholder.com/256x256/6366f1/ffffff?text=Design+1'
    },
    {
      id: 'mock-2',
      s3Url: 'https://via.placeholder.com/512x512/8b5cf6/ffffff?text=Design+2',
      thumbnailUrl: 'https://via.placeholder.com/256x256/8b5cf6/ffffff?text=Design+2'
    },
    {
      id: 'mock-3',
      s3Url: 'https://via.placeholder.com/512x512/ec4899/ffffff?text=Design+3',
      thumbnailUrl: 'https://via.placeholder.com/256x256/ec4899/ffffff?text=Design+3'
    }
  ];
  handleGenerationSuccess(mockDesigns);
}, 3000);
```

## Next Steps

1. Deploy the AWS Lambda function for design generation (Task 7.1-7.5)
2. Set up API Gateway endpoint
3. Configure the API URL in theme settings
4. Test the complete workflow

## Related Files

- `assets/design-generation.js` - Frontend design generation logic
- `assets/workflow-state.js` - Workflow state management
- `snippets/design-generation.liquid` - Design generation UI
- `templates/page.customize.liquid` - Customization page template
