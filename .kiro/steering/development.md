# Development Guidelines

## Code Style

### JavaScript/TypeScript
- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use async/await over promises chains
- Destructure objects and arrays
- Use template literals for strings
- Add JSDoc comments for functions

```javascript
/**
 * Generate design using Amazon Bedrock
 * @param {string} prompt - User's mood description
 * @param {string} productType - Type of product (tshirt, mug, etc.)
 * @returns {Promise<string>} S3 URL of generated design
 */
async function generateDesign(prompt, productType) {
  // Implementation
}
```

### Liquid Templates
- Keep logic minimal in templates
- Use meaningful variable names
- Comment complex logic
- Prefer snippets for reusable components
- Use schema settings for customization

```liquid
{% comment %}
  Mood input form component
  Accepts: product_type, default_prompt
{% endcomment %}
<div class="mood-input">
  {% render 'mood-form', product: product %}
</div>
```

### CSS/SCSS
- Use BEM naming convention
- Mobile-first responsive design
- Use CSS variables for theming
- Avoid !important
- Group related properties

```css
.product-customizer {
  /* Layout */
  display: flex;
  flex-direction: column;
  
  /* Spacing */
  padding: 1rem;
  gap: 1rem;
  
  /* Visual */
  background: var(--bg-primary);
  border-radius: 8px;
}
```

## Error Handling

### Frontend
- Show user-friendly error messages
- Provide actionable next steps
- Log errors for debugging
- Implement retry mechanisms

```javascript
try {
  const design = await generateDesign(prompt);
  showPreview(design);
} catch (error) {
  if (error.code === 'CONTENT_POLICY_VIOLATION') {
    showError('Please try a different description');
  } else if (error.code === 'TIMEOUT') {
    showError('Generation taking longer than expected. Retry?');
  } else {
    showError('Something went wrong. Please try again.');
  }
  logError(error);
}
```

### Backend
- Use structured error responses
- Include error codes for client handling
- Log full error context
- Implement circuit breakers

```javascript
class BedrockError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Usage
throw new BedrockError(
  'Content policy violation',
  'CONTENT_POLICY_VIOLATION',
  { prompt, modelId }
);
```

## Testing Strategy

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Aim for 80%+ code coverage
- Use descriptive test names

```javascript
describe('generateDesign', () => {
  it('should generate design from text prompt', async () => {
    const mockBedrock = jest.fn().mockResolvedValue(mockImage);
    const result = await generateDesign('happy', 'tshirt');
    expect(result).toContain('s3://');
  });
  
  it('should throw error for invalid prompt', async () => {
    await expect(generateDesign('', 'tshirt'))
      .rejects.toThrow('Invalid prompt');
  });
});
```

### Integration Tests
- Test API endpoints end-to-end
- Use test AWS account
- Test Shopify webhook handling
- Verify Shiprocket integration

### Manual Testing Checklist
- [ ] Mood input generates appropriate designs
- [ ] Image upload works with various formats
- [ ] Design preview renders correctly on all products
- [ ] Cart preserves design information
- [ ] Order webhook triggers fulfillment
- [ ] Tracking updates sync to Shopify

## API Design Principles

### RESTful Endpoints
```
POST /api/generate-design
Body: { prompt: string, productType: string }
Response: { designUrl: string, designId: string }

POST /api/upload-image
Body: FormData with image file
Response: { imageUrl: string }

POST /api/webhook/shopify
Body: Shopify webhook payload
Response: { success: boolean }
```

### Request Validation
- Validate all inputs
- Sanitize user-provided data
- Check file types and sizes
- Rate limit requests

### Response Format
```javascript
// Success
{
  success: true,
  data: { designUrl: "...", designId: "..." }
}

// Error
{
  success: false,
  error: {
    code: "INVALID_PROMPT",
    message: "Prompt must be between 3 and 500 characters",
    details: {}
  }
}
```

## Performance Best Practices

### Frontend
- Lazy load images
- Debounce user input
- Show loading states
- Optimize bundle size
- Use CDN for assets

### Backend
- Cache frequently used data
- Batch API requests
- Use connection pooling
- Implement timeouts
- Optimize Lambda cold starts

### Database/Storage
- Use appropriate S3 storage classes
- Implement lifecycle policies
- Index frequently queried fields
- Paginate large result sets

## Security Best Practices

### Input Validation
- Validate all user inputs
- Sanitize file uploads
- Check file types and sizes
- Prevent injection attacks

### Authentication & Authorization
- Use Shopify OAuth for app
- Validate webhook signatures
- Use IAM roles for AWS services
- Implement API key rotation

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Don't log sensitive information
- Implement data retention policies

### Content Moderation
- Use Bedrock content filters
- Implement additional prompt filtering
- Review flagged content
- Provide user reporting mechanism

## Git Workflow

### Branch Strategy
- `main`: Production code
- `develop`: Integration branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Production hotfixes

### Commit Messages
```
feat: Add mood-based design generation
fix: Resolve S3 upload timeout issue
docs: Update API documentation
refactor: Simplify Bedrock client code
test: Add integration tests for webhooks
```

### Pull Request Process
1. Create feature branch from `develop`
2. Implement changes with tests
3. Update documentation
4. Create PR with description
5. Code review and approval
6. Merge to `develop`
7. Deploy to staging for testing
8. Merge to `main` for production

## Documentation

### Code Comments
- Explain "why" not "what"
- Document complex algorithms
- Add TODO comments for future work
- Keep comments up to date

### API Documentation
- Document all endpoints
- Include request/response examples
- List error codes and meanings
- Provide authentication details

### README Files
- Setup instructions
- Environment variables
- Common commands
- Troubleshooting guide
