#!/usr/bin/env python3
"""
Deploy compositor Lambda function using AWS Lambda Layer for Pillow
This avoids cross-platform compilation issues
"""
import boto3
import zipfile
import io
import os
import sys

def create_lambda_package():
    """Create deployment package with just the function code"""
    print("Creating Lambda deployment package (code only)...")
    
    # Create in-memory zip file
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Add the Lambda function code
        zip_file.write('src/composite_design.py', 'composite_design.py')
        print("✓ Added composite_design.py")
    
    zip_buffer.seek(0)
    return zip_buffer.getvalue()

def get_or_create_pillow_layer(lambda_client):
    """Get existing Pillow layer or use public one"""
    # Use AWS-maintained Pillow layer ARN for Python 3.11
    # This is a public layer that includes Pillow pre-compiled for Lambda
    pillow_layer_arn = "arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p311-pillow:1"
    
    print(f"Using Pillow Lambda Layer: {pillow_layer_arn}")
    return pillow_layer_arn

def deploy_lambda(function_name, zip_content, layer_arn):
    """Deploy Lambda function with layer"""
    lambda_client = boto3.client('lambda', region_name='us-east-1')
    
    try:
        print(f"\nDeploying Lambda function: {function_name}")
        
        # Update function code
        response = lambda_client.update_function_code(
            FunctionName=function_name,
            ZipFile=zip_content
        )
        
        print(f"✓ Lambda code updated")
        print(f"  Code Size: {response['CodeSize']} bytes")
        
        # Update function configuration to use layer
        print("\nUpdating function configuration with Pillow layer...")
        config_response = lambda_client.update_function_configuration(
            FunctionName=function_name,
            Layers=[layer_arn]
        )
        
        print(f"✓ Lambda configuration updated")
        print(f"  Function ARN: {config_response['FunctionArn']}")
        print(f"  Runtime: {config_response['Runtime']}")
        print(f"  Layers: {len(config_response.get('Layers', []))}")
        
        return True
        
    except lambda_client.exceptions.ResourceNotFoundException:
        print(f"✗ Lambda function '{function_name}' not found")
        print("  Please deploy the CloudFormation stack first")
        return False
    except Exception as e:
        print(f"✗ Error deploying Lambda: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main deployment function"""
    print("=" * 60)
    print("AI Merchandise - Compositor Lambda Deployment (with Layer)")
    print("=" * 60)
    
    # Change to python-backend directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    lambda_client = boto3.client('lambda', region_name='us-east-1')
    
    # Get Pillow layer
    layer_arn = get_or_create_pillow_layer(lambda_client)
    
    # Create deployment package (code only)
    zip_content = create_lambda_package()
    
    # Deploy Lambda function
    function_name = 'ai-merchandise-compositor-dev'
    success = deploy_lambda(function_name, zip_content, layer_arn)
    
    if success:
        print("\n" + "=" * 60)
        print("✓ Deployment completed successfully!")
        print("=" * 60)
        print("\nCompositor API Endpoint:")
        print("https://letb0j7l89.execute-api.us-east-1.amazonaws.com/dev/composite-design")
        print("\nTest with:")
        print('curl -X POST https://letb0j7l89.execute-api.us-east-1.amazonaws.com/dev/composite-design \\')
        print('  -H "Content-Type: application/json" \\')
        print('  -d \'{"designUrl": "YOUR_DESIGN_URL", "productType": "tshirt"}\'')
        return 0
    else:
        print("\n" + "=" * 60)
        print("✗ Deployment failed")
        print("=" * 60)
        return 1

if __name__ == '__main__':
    sys.exit(main())
