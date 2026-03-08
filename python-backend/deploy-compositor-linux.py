#!/usr/bin/env python3
"""
Deploy compositor Lambda function with Linux-compatible Pillow
Uses pip with --platform flag to download Linux wheels
"""
import boto3
import zipfile
import io
import os
import sys
import subprocess
import shutil
import tempfile

def install_linux_dependencies(temp_dir):
    """Install Python dependencies for Linux platform"""
    print("Installing dependencies for Linux (manylinux)...")
    
    # Install packages for Linux platform
    subprocess.check_call([
        sys.executable, '-m', 'pip', 'install',
        '--target', temp_dir,
        '--platform', 'manylinux2014_x86_64',
        '--implementation', 'cp',
        '--python-version', '3.11',
        '--only-binary=:all:',
        '--upgrade',
        'Pillow',
        'requests'
    ])
    
    print("✓ Linux-compatible dependencies installed")

def create_lambda_package():
    """Create deployment package with Linux dependencies"""
    print("Creating Lambda deployment package...")
    
    # Create temporary directory for dependencies
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Install Linux dependencies
        install_linux_dependencies(temp_dir)
        
        # Create in-memory zip file
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add dependencies from temp directory
            for root, dirs, files in os.walk(temp_dir):
                # Skip __pycache__ and .dist-info directories
                dirs[:] = [d for d in dirs if d not in ['__pycache__', '*.dist-info']]
                
                for file in files:
                    # Skip .pyc files
                    if file.endswith('.pyc'):
                        continue
                    
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zip_file.write(file_path, arcname)
            
            # Add the Lambda function code
            zip_file.write('src/composite_design.py', 'composite_design.py')
            print("✓ Added composite_design.py")
        
        zip_buffer.seek(0)
        return zip_buffer.getvalue()
    
    finally:
        # Clean up temp directory
        shutil.rmtree(temp_dir)

def deploy_lambda(function_name, zip_content):
    """Deploy Lambda function"""
    lambda_client = boto3.client('lambda', region_name='us-east-1')
    
    try:
        print(f"\nDeploying Lambda function: {function_name}")
        
        # Check if package size is within limits
        size_mb = len(zip_content) / (1024 * 1024)
        print(f"  Package size: {size_mb:.2f} MB")
        
        if size_mb > 50:
            print("✗ Package too large (>50MB). Consider using Lambda layers.")
            return False
        
        response = lambda_client.update_function_code(
            FunctionName=function_name,
            ZipFile=zip_content
        )
        
        print(f"✓ Lambda function updated successfully")
        print(f"  Function ARN: {response['FunctionArn']}")
        print(f"  Runtime: {response['Runtime']}")
        print(f"  Last Modified: {response['LastModified']}")
        print(f"  Code Size: {response['CodeSize']} bytes")
        
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
    print("AI Merchandise - Compositor Lambda Deployment (Linux)")
    print("=" * 60)
    
    # Change to python-backend directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Create deployment package
    zip_content = create_lambda_package()
    
    # Deploy Lambda function
    function_name = 'ai-merchandise-compositor-dev'
    success = deploy_lambda(function_name, zip_content)
    
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
