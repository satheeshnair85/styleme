import json
import base64
import boto3
import uuid
import random
import os
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

# Initialize AWS clients
bedrock_client = boto3.client("bedrock-runtime", region_name=os.environ.get('AWS_REGION', 'us-east-1'))
s3_client = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

def handler(event, context):
    """
    Lambda handler for AI design generation
    """
    try:
        # CORS headers
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            'Content-Type': 'application/json'
        }
        
        # Handle preflight OPTIONS request
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'CORS preflight'})
            }
        
        # Validate API key for basic authentication
        api_key = event.get('headers', {}).get('X-Api-Key') or event.get('headers', {}).get('x-api-key')
        if not api_key or api_key != os.environ.get('API_KEY'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'Unauthorized - Invalid API Key'
                })
            }
        
        # Parse request body
        if not event.get('body'):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'Request body is required'
                })
            }
        
        try:
            body = json.loads(event['body'])
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'Invalid JSON in request body'
                })
            }
        
        # Extract parameters
        prompt = body.get('prompt', '').strip()
        product_type = body.get('productType', 'tshirt').lower()
        user_id = body.get('userId')  # Optional - for logged in users
        style = body.get('style', 'standard')
        
        if not prompt:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'Prompt is required'
                })
            }
        
        # Generate design
        design_result = generate_design_with_nova(prompt, product_type, style)
        
        # Upload to S3 and get presigned URL
        s3_info = upload_to_s3(design_result['image_data'], user_id, product_type)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'data': {
                    'designUrl': s3_info['presigned_url'],
                    'designId': s3_info['design_id'],
                    'bucket': s3_info['bucket'],
                    'key': s3_info['key'],
                    'expiresIn': 3600,  # 1 hour
                    'prompt': prompt,
                    'productType': product_type
                }
            })
        }
        
    except Exception as e:
        print(f"Error in generate_design handler: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': False,
                'error': 'Internal server error',
                'details': str(e) if os.environ.get('STAGE') == 'dev' else None
            })
        }

def generate_design_with_nova(prompt, product_type, style='standard'):
    """
    Generate design using Amazon Nova Canvas
    """
    try:
        # Optimize prompt for product type
        optimized_prompt = optimize_prompt_for_product(prompt, product_type)
        
        # Set model ID for Nova Canvas
        model_id = "amazon.nova-canvas-v1:0"
        
        # Generate random seed
        seed = random.randint(0, 858993460)
        
        # Determine image dimensions based on product type
        dimensions = get_product_dimensions(product_type)
        
        # Format request for Nova Canvas
        native_request = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {
                "text": optimized_prompt,
                "negativeText": "blurry, low quality, distorted, watermark, signature, text, words, letters, copyright"
            },
            "imageGenerationConfig": {
                "seed": seed,
                "quality": "premium" if style == "premium" else "standard",
                "height": dimensions['height'],
                "width": dimensions['width'],
                "numberOfImages": 1,
                "cfgScale": 7.0  # Guidance scale for prompt adherence
            },
        }
        
        # Convert to JSON
        request_body = json.dumps(native_request)
        
        print(f"Generating image with prompt: {optimized_prompt}")
        print(f"Dimensions: {dimensions['width']}x{dimensions['height']}")
        
        # Invoke Nova Canvas model
        response = bedrock_client.invoke_model(
            modelId=model_id,
            body=request_body
        )
        
        # Parse response
        model_response = json.loads(response["body"].read())
        
        # Extract image data
        base64_image_data = model_response["images"][0]
        image_data = base64.b64decode(base64_image_data)
        
        return {
            'image_data': image_data,
            'seed': seed,
            'prompt': optimized_prompt,
            'dimensions': dimensions
        }
        
    except ClientError as e:
        print(f"Bedrock API error: {str(e)}")
        raise Exception(f"Failed to generate image: {str(e)}")
    except Exception as e:
        print(f"Image generation error: {str(e)}")
        raise Exception(f"Image generation failed: {str(e)}")

def optimize_prompt_for_product(prompt, product_type):
    """
    Optimize prompt based on product type for better results
    """
    base_prompt = prompt.strip()
    
    product_optimizations = {
        'tshirt': f"{base_prompt}, t-shirt design, graphic design, vector art style, clean design, high contrast, suitable for screen printing, centered design, no background",
        'mug': f"{base_prompt}, mug design, wraparound design suitable for coffee mug, printable design, vibrant colors, no background",
        'cap': f"{base_prompt}, cap design, hat design, embroidery style, simple clean design, logo style, suitable for embroidery, no background",
        'sticker': f"{base_prompt}, sticker design, die-cut sticker style, vibrant colors, simple clean design, cartoon style, no background",
        'hoodie': f"{base_prompt}, hoodie design, sweatshirt graphic, streetwear style, bold design, high contrast, suitable for screen printing, no background",
        'poster': f"{base_prompt}, poster design, wall art, high resolution, artistic style, detailed illustration",
        'phone_case': f"{base_prompt}, phone case design, mobile cover art, compact design, vibrant colors, no background"
    }
    
    return product_optimizations.get(product_type, f"{base_prompt}, product design, printable design, high quality, no background")

def get_product_dimensions(product_type):
    """
    Get optimal image dimensions for different product types
    """
    dimensions = {
        'tshirt': {'width': 1024, 'height': 1024},
        'mug': {'width': 1024, 'height': 512},
        'cap': {'width': 1024, 'height': 512},
        'sticker': {'width': 1024, 'height': 1024},
        'hoodie': {'width': 1024, 'height': 1024},
        'poster': {'width': 1024, 'height': 1536},
        'phone_case': {'width': 512, 'height': 1024}
    }
    
    return dimensions.get(product_type, {'width': 1024, 'height': 1024})

def upload_to_s3(image_data, user_id=None, product_type='tshirt'):
    """
    Upload image to S3 and return presigned URL
    """
    try:
        # Generate unique design ID
        design_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Determine bucket and key based on user authentication
        if user_id:
            # Logged in user - use user bucket with user ID folder
            bucket = os.environ.get('S3_BUCKET_USER')
            key = f"{user_id}/{product_type}/{timestamp}_{design_id}.png"
        else:
            # Anonymous user - use anonymous bucket
            bucket = os.environ.get('S3_BUCKET_ANONYMOUS')
            key = f"anonymous/{product_type}/{timestamp}_{design_id}.png"
        
        if not bucket:
            raise Exception("S3 bucket not configured")
        
        # Upload to S3
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=image_data,
            ContentType='image/png',
            Metadata={
                'design-id': design_id,
                'product-type': product_type,
                'user-id': user_id or 'anonymous',
                'created-at': datetime.now().isoformat()
            }
        )
        
        # Generate presigned URL (valid for 1 hour)
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=3600  # 1 hour
        )
        
        print(f"Image uploaded to S3: s3://{bucket}/{key}")
        
        return {
            'design_id': design_id,
            'bucket': bucket,
            'key': key,
            'presigned_url': presigned_url
        }
        
    except Exception as e:
        print(f"S3 upload error: {str(e)}")
        raise Exception(f"Failed to upload image to S3: {str(e)}")