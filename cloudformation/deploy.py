#!/usr/bin/env python3
"""
CloudFormation deployment script for AI Merchandise Platform
"""
import os
import sys
import json
import boto3
import zipfile
import tempfile
from pathlib import Path
from botocore.exceptions import ClientError
import time

class CloudFormationDeployer:
    def __init__(self):
        self.cf_client = boto3.client('cloudformation')
        self.lambda_client = boto3.client('lambda')
        self.s3_client = boto3.client('s3')
        
    def create_lambda_package(self):
        """Create Lambda deployment package"""
        print("📦 Creating Lambda deployment package...")
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Copy Lambda function code
            lambda_code_path = Path(__file__).parent.parent / 'python-backend' / 'src' / 'generate_design.py'
            if not lambda_code_path.exists():
                raise FileNotFoundError(f"Lambda code not found: {lambda_code_path}")
            
            # Copy to temp directory
            import shutil
            shutil.copy2(lambda_code_path, temp_path / 'generate_design.py')
            
            # Create requirements.txt in temp directory
            requirements_content = """boto3==1.34.0
botocore==1.34.0
Pillow==10.2.0"""
            
            with open(temp_path / 'requirements.txt', 'w') as f:
                f.write(requirements_content)
            
            # Install dependencies
            print("📥 Installing Python dependencies...")
            os.system(f'pip install -r {temp_path}/requirements.txt -t {temp_path}')
            
            # Create ZIP file
            zip_path = temp_path / 'lambda-package.zip'
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in temp_path.rglob('*'):
                    if file_path.is_file() and file_path.name != 'lambda-package.zip':
                        arcname = file_path.relative_to(temp_path)
                        zipf.write(file_path, arcname)
            
            # Read ZIP content
            with open(zip_path, 'rb') as f:
                zip_content = f.read()
            
            print(f"✅ Lambda package created ({len(zip_content)} bytes)")
            return zip_content

    def deploy_stack(self, stack_name, environment='dev', api_key=None):
        """Deploy CloudFormation stack"""
        print(f"🚀 Deploying CloudFormation stack: {stack_name}")
        
        # Read template
        template_path = Path(__file__).parent / 'ai-merchandise-stack.yaml'
        with open(template_path, 'r') as f:
            template_body = f.read()
        
        # Parameters
        parameters = [
            {'ParameterKey': 'Environment', 'ParameterValue': environment},
            {'ParameterKey': 'ShopifyDomain', 'ParameterValue': 'stylemytravel-dev.myshopify.com'}
        ]
        
        if api_key:
            parameters.append({'ParameterKey': 'ApiKeyValue', 'ParameterValue': api_key})
        
        try:
            # Check if stack exists
            try:
                self.cf_client.describe_stacks(StackName=stack_name)
                stack_exists = True
                print(f"📋 Stack {stack_name} exists, updating...")
            except ClientError as e:
                if 'does not exist' in str(e):
                    stack_exists = False
                    print(f"📋 Stack {stack_name} does not exist, creating...")
                else:
                    raise
            
            # Deploy stack
            if stack_exists:
                response = self.cf_client.update_stack(
                    StackName=stack_name,
                    TemplateBody=template_body,
                    Parameters=parameters,
                    Capabilities=['CAPABILITY_NAMED_IAM']
                )
                operation = 'UPDATE'
            else:
                response = self.cf_client.create_stack(
                    StackName=stack_name,
                    TemplateBody=template_body,
                    Parameters=parameters,
                    Capabilities=['CAPABILITY_NAMED_IAM'],
                    OnFailure='ROLLBACK'
                )
                operation = 'CREATE'
            
            print(f"⏳ Waiting for stack {operation} to complete...")
            
            # Wait for completion
            if operation == 'CREATE':
                waiter = self.cf_client.get_waiter('stack_create_complete')
            else:
                waiter = self.cf_client.get_waiter('stack_update_complete')
            
            waiter.wait(
                StackName=stack_name,
                WaiterConfig={'Delay': 15, 'MaxAttempts': 120}
            )
            
            print(f"✅ Stack {operation} completed successfully!")
            return True
            
        except ClientError as e:
            if 'No updates are to be performed' in str(e):
                print("ℹ️  No updates needed for the stack")
                return True
            else:
                print(f"❌ Stack deployment failed: {str(e)}")
                return False

    def update_lambda_code(self, function_name, zip_content):
        """Update Lambda function code"""
        print(f"🔄 Updating Lambda function code: {function_name}")
        
        try:
            self.lambda_client.update_function_code(
                FunctionName=function_name,
                ZipFile=zip_content
            )
            print("✅ Lambda function code updated successfully!")
            return True
        except ClientError as e:
            print(f"❌ Failed to update Lambda code: {str(e)}")
            return False

    def get_stack_outputs(self, stack_name):
        """Get CloudFormation stack outputs"""
        try:
            response = self.cf_client.describe_stacks(StackName=stack_name)
            stack = response['Stacks'][0]
            
            outputs = {}
            if 'Outputs' in stack:
                for output in stack['Outputs']:
                    outputs[output['OutputKey']] = output['OutputValue']
            
            return outputs
        except ClientError as e:
            print(f"❌ Failed to get stack outputs: {str(e)}")
            return {}

    def delete_stack(self, stack_name):
        """Delete CloudFormation stack"""
        print(f"🗑️  Deleting CloudFormation stack: {stack_name}")
        
        try:
            self.cf_client.delete_stack(StackName=stack_name)
            
            print("⏳ Waiting for stack deletion to complete...")
            waiter = self.cf_client.get_waiter('stack_delete_complete')
            waiter.wait(
                StackName=stack_name,
                WaiterConfig={'Delay': 15, 'MaxAttempts': 120}
            )
            
            print("✅ Stack deleted successfully!")
            return True
            
        except ClientError as e:
            print(f"❌ Stack deletion failed: {str(e)}")
            return False

def main():
    """Main deployment function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Deploy AI Merchandise Platform')
    parser.add_argument('--action', choices=['deploy', 'delete', 'update-code'], 
                       default='deploy', help='Action to perform')
    parser.add_argument('--stack-name', default='ai-merchandise-platform-dev',
                       help='CloudFormation stack name')
    parser.add_argument('--environment', default='dev',
                       help='Environment (dev, staging, prod)')
    parser.add_argument('--api-key', help='API key for authentication')
    
    args = parser.parse_args()
    
    deployer = CloudFormationDeployer()
    
    if args.action == 'deploy':
        print("🚀 Starting deployment...")
        print("=" * 60)
        
        # Get API key from environment if not provided
        api_key = args.api_key or os.getenv('API_KEY')
        if not api_key:
            print("❌ API_KEY not found. Please set it in environment or use --api-key")
            sys.exit(1)
        
        # Create Lambda package
        zip_content = deployer.create_lambda_package()
        
        # Deploy stack
        success = deployer.deploy_stack(args.stack_name, args.environment, api_key)
        
        if success:
            # Update Lambda code
            function_name = f"ai-merchandise-design-generator-{args.environment}"
            deployer.update_lambda_code(function_name, zip_content)
            
            # Get outputs
            outputs = deployer.get_stack_outputs(args.stack_name)
            
            print("\n🎉 Deployment completed successfully!")
            print("=" * 60)
            print("📋 Stack Outputs:")
            for key, value in outputs.items():
                print(f"   {key}: {value}")
            
            if 'ApiGatewayUrl' in outputs:
                print(f"\n🌐 API Endpoint: {outputs['ApiGatewayUrl']}")
                print(f"🔑 API Key: {api_key}")
                print("\n📝 Test with:")
                print(f"curl -X POST {outputs['ApiGatewayUrl']} \\")
                print(f"  -H 'Content-Type: application/json' \\")
                print(f"  -H 'X-Api-Key: {api_key}' \\")
                print(f"  -d '{{\"prompt\": \"cute cat\", \"productType\": \"tshirt\"}}'")
        
    elif args.action == 'delete':
        print("🗑️  Starting stack deletion...")
        deployer.delete_stack(args.stack_name)
        
    elif args.action == 'update-code':
        print("🔄 Updating Lambda code only...")
        zip_content = deployer.create_lambda_package()
        function_name = f"ai-merchandise-design-generator-{args.environment}"
        deployer.update_lambda_code(function_name, zip_content)

if __name__ == "__main__":
    main()