#!/usr/bin/env python3
"""
Fixed deployment script for AI Merchandise Platform
"""
import os
import sys
import json
import boto3
import time
import zipfile
import tempfile
from pathlib import Path
from botocore.exceptions import ClientError

def load_env():
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

def create_lambda_package():
    """Create Lambda deployment package"""
    print("📦 Creating Lambda package...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Copy Lambda function
        lambda_code_path = Path(__file__).parent.parent / 'python-backend' / 'src' / 'generate_design.py'
        if not lambda_code_path.exists():
            print(f"❌ Lambda code not found: {lambda_code_path}")
            return None
        
        import shutil
        shutil.copy2(lambda_code_path, temp_path / 'generate_design.py')
        
        # Create ZIP
        zip_path = temp_path / 'lambda-package.zip'
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(temp_path / 'generate_design.py', 'generate_design.py')
        
        with open(zip_path, 'rb') as f:
            zip_content = f.read()
        
        print(f"✅ Lambda package created ({len(zip_content)} bytes)")
        return zip_content

def deploy_stack():
    """Deploy CloudFormation stack"""
    print("🚀 Deploying AI Merchandise Platform...")
    
    # Load environment
    load_env()
    
    # Initialize clients
    cf_client = boto3.client('cloudformation')
    lambda_client = boto3.client('lambda')
    
    stack_name = 'ai-merchandise-platform-dev'
    
    try:
        # Test credentials
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        print(f"✅ AWS Account: {identity['Account']}")
        print(f"✅ AWS Region: {os.getenv('AWS_REGION', 'us-east-1')}")
        
        # Read template
        template_path = Path(__file__).parent / 'ai-merchandise-stack.yaml'
        with open(template_path, 'r') as f:
            template_body = f.read()
        
        # Parameters
        api_key = os.getenv('API_KEY', 'sk-ai-merchandise-2024-secure-key-xyz789')
        parameters = [
            {'ParameterKey': 'Environment', 'ParameterValue': 'dev'},
            {'ParameterKey': 'ApiKeyValue', 'ParameterValue': api_key},
            {'ParameterKey': 'ShopifyDomain', 'ParameterValue': 'stylemytravel-dev.myshopify.com'}
        ]
        
        # Deploy stack
        print("🆕 Creating new stack...")
        cf_client.create_stack(
            StackName=stack_name,
            TemplateBody=template_body,
            Parameters=parameters,
            Capabilities=['CAPABILITY_NAMED_IAM']
        )
        
        # Wait for completion with detailed error reporting
        print("⏳ Waiting for deployment to complete...")
        
        max_attempts = 40
        for attempt in range(max_attempts):
            try:
                response = cf_client.describe_stacks(StackName=stack_name)
                status = response['Stacks'][0]['StackStatus']
                
                print(f"   Status: {status} ({attempt + 1}/{max_attempts})")
                
                if status == 'CREATE_COMPLETE':
                    print("✅ Stack deployment completed!")
                    break
                elif status in ['CREATE_FAILED', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED']:
                    print(f"❌ Stack deployment failed with status: {status}")
                    
                    # Get failure details
                    events = cf_client.describe_stack_events(StackName=stack_name)
                    failed_events = [e for e in events['StackEvents'] if 'FAILED' in e.get('ResourceStatus', '')]
                    
                    if failed_events:
                        print("\n❌ Failure details:")
                        for event in failed_events[:3]:
                            resource = event.get('LogicalResourceId', 'Unknown')
                            reason = event.get('ResourceStatusReason', 'No reason provided')
                            print(f"   {resource}: {reason}")
                    
                    return False
                
                time.sleep(30)
                
            except Exception as e:
                print(f"❌ Error checking stack status: {str(e)}")
                return False
        
        if attempt >= max_attempts - 1:
            print("❌ Timeout waiting for stack completion")
            return False
        
        # Create Lambda package and update code
        zip_content = create_lambda_package()
        if zip_content:
            function_name = 'ai-merchandise-design-generator-dev'
            print(f"🔄 Updating Lambda function code...")
            
            try:
                lambda_client.update_function_code(
                    FunctionName=function_name,
                    ZipFile=zip_content
                )
                print("✅ Lambda code updated!")
            except Exception as e:
                print(f"⚠️  Lambda update failed: {str(e)}")
        
        # Get stack outputs
        response = cf_client.describe_stacks(StackName=stack_name)
        stack = response['Stacks'][0]
        
        if 'Outputs' in stack:
            print("\n🎉 Deployment successful!")
            print("=" * 60)
            for output in stack['Outputs']:
                key = output['OutputKey']
                value = output['OutputValue']
                print(f"{key}: {value}")
            
            # Show test command
            api_url = None
            for output in stack['Outputs']:
                if output['OutputKey'] == 'ApiGatewayUrl':
                    api_url = output['OutputValue']
                    break
            
            if api_url:
                print(f"\n🧪 Test your API:")
                print(f"curl -X POST {api_url} \\")
                print(f"  -H 'Content-Type: application/json' \\")
                print(f"  -H 'X-Api-Key: {api_key}' \\")
                print(f"  -d '{{\"prompt\": \"cute cat wearing sunglasses\", \"productType\": \"tshirt\"}}'")
                
                print(f"\n🌐 API Endpoint for Shopify:")
                print(f"URL: {api_url}")
                print(f"API Key: {api_key}")
        
        return True
        
    except Exception as e:
        print(f"❌ Deployment failed: {str(e)}")
        return False

def main():
    """Main function"""
    print("🚀 AI Merchandise Platform - Fixed Deployment")
    print("=" * 60)
    
    success = deploy_stack()
    if success:
        print("\n✅ Deployment completed successfully!")
        print("\n📋 Next steps:")
        print("1. Test the API endpoint above")
        print("2. Update your Shopify theme to use the new API URL")
        print("3. Add the API key to your Shopify theme settings")
    else:
        print("\n❌ Deployment failed")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()