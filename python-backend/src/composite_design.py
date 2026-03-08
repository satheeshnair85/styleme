import json
import boto3
import os
import io
import requests
from PIL import Image
from datetime import datetime, timedelta
import uuid

s3_client = boto3.client('s3')

# Product templates with print area coordinates
PRODUCT_TEMPLATES = {
    'tshirt': {
        'print_area': {'x': 134, 'y': 172, 'width': 267, 'height': 338},
        'mockup_size': (533, 666)
    },
    'hoodie': {
        'print_area': {'x': 140, 'y': 180, 'width': 320, 'height': 420},
        'mockup_size': (600, 800)
    }
}

def lambda_handler(event, context):
    """
    Composite AI-generated design onto product mockup
    """
    try:
        # Parse input
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', event)
        
        design_url = body.get('designUrl')
        product_type = body.get('productType', 'tshirt')
        mockup_url = body.get('mockupUrl')
        
        # Validate inputs
        if not design_url:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'success': False,
                    'error': 'designUrl is required'
                })
            }
        
        # Validate product type
        if product_type not in PRODUCT_TEMPLATES:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'success': False,
                    'error': f'Invalid product type. Supported: {list(PRODUCT_TEMPLATES.keys())}'
                })
            }
        
        print(f"Compositing design for {product_type}")
        print(f"Design URL: {design_url}")
        print(f"Mockup URL: {mockup_url}")
        
        # Download AI-generated design
        design_img = download_image(design_url)
        
        # Get or download mockup template
        mockup_img = get_mockup_image(mockup_url, product_type)
        
        # Composite the images
        composite_img = composite_design(design_img, mockup_img, product_type)
        
        # Upload to S3
        bucket_name = os.environ.get('COMPOSITE_BUCKET_NAME')
        composite_url = upload_composite_to_s3(composite_img, bucket_name)
        
        print(f"Composite created: {composite_url}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'data': {
                    'compositeUrl': composite_url,
                    'productType': product_type
                }
            })
        }
        
    except Exception as e:
        print(f"Error in composite_design: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }


def download_image(url):
    """Download image from URL"""
    print(f"Downloading image from: {url}")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    img = Image.open(io.BytesIO(response.content))
    
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    print(f"Downloaded image size: {img.size}")
    return img


def get_mockup_image(mockup_url, product_type):
    """Get mockup template - either from URL or use default"""
    template = PRODUCT_TEMPLATES[product_type]
    
    if mockup_url:
        # Download provided mockup
        mockup_img = download_image(mockup_url)
    else:
        # Create blank mockup with correct size
        mockup_size = template['mockup_size']
        mockup_img = Image.new('RGBA', mockup_size, (255, 255, 255, 255))
        print(f"Created blank mockup: {mockup_size}")
    
    # Ensure correct size
    expected_size = template['mockup_size']
    if mockup_img.size != expected_size:
        print(f"Resizing mockup from {mockup_img.size} to {expected_size}")
        mockup_img = mockup_img.resize(expected_size, Image.Resampling.LANCZOS)
    
    return mockup_img


def composite_design(design_img, mockup_img, product_type):
    """Composite design onto mockup using template coordinates"""
    template = PRODUCT_TEMPLATES[product_type]
    print_area = template['print_area']
    
    print(f"Print area: {print_area}")
    print(f"Original design size: {design_img.size}")
    
    # Resize design to fit print area
    target_size = (print_area['width'], print_area['height'])
    design_resized = design_img.resize(target_size, Image.Resampling.LANCZOS)
    
    print(f"Resized design to: {design_resized.size}")
    
    # Create a copy of mockup to avoid modifying original
    composite = mockup_img.copy()
    
    # Paste design onto mockup at specified coordinates
    # Use design as mask to preserve transparency
    position = (print_area['x'], print_area['y'])
    
    if design_resized.mode == 'RGBA':
        # Use alpha channel as mask
        composite.paste(design_resized, position, design_resized)
    else:
        composite.paste(design_resized, position)
    
    print(f"Composite created: {composite.size}")
    
    return composite


def upload_composite_to_s3(image, bucket_name):
    """Upload composite image to S3 and return presigned URL"""
    # Convert image to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG', optimize=True)
    img_byte_arr.seek(0)
    
    # Generate unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    key = f"composites/{timestamp}_{unique_id}.png"
    
    # Upload to S3
    s3_client.put_object(
        Bucket=bucket_name,
        Key=key,
        Body=img_byte_arr.getvalue(),
        ContentType='image/png'
    )
    
    print(f"Uploaded to S3: s3://{bucket_name}/{key}")
    
    # Generate presigned URL (valid for 7 days)
    presigned_url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': bucket_name,
            'Key': key
        },
        ExpiresIn=604800  # 7 days
    )
    
    return presigned_url
