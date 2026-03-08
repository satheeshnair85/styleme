#!/usr/bin/env python3
"""
Auto-deployment script with error detection and correction
"""
import os
import sys
import json
import boto3
import time
from pathlib import Path
from botocore.exceptions import ClientError, NoCredentialsError
import subprocess
import zipfile
import tempfile

class AutoDeployer:
    def __init__(self):
        self.cf_client = None
        self.lambda_client = None
        self.stack_name = 'ai-merchandise-platform-dev'
        self.environment = 'dev'
        
    def check_aws_credentials(self):
        """Check and configure AWS credentials"""
        try:
            # Load from .env file first
            env_path = Path(__file__).parent.parent / '.env'
            if env_path.exists():
                print("📋 Loading credentials from .env file...")
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            os.environ[key] = value
                            if key == 'AWS_ACCESS_KEY_ID':
                                print(f"   Access Key: {value[:8]}...{value[-4:]}")
                            elif key == 'AWS_REGION':
                                print(f"   Region: {value}")
            
            # Set AWS environment variables explicitly
            os.environ['AWS_DEFAULT_REGION'] = os.getenv('AWS_REGION', 'us-east-1')
            
            # Try to create clients
            self.cf_client = boto3.client('cloudformation')
            self.lambda_client = boto3.client('lambda')
            
            # Test credentials
            sts = boto3.client('sts')
            identity = sts.get_caller_identity()
            print(f"✅ AWS Account: {identity['Account']}")
            print(f"✅ AWS User: {identity['Arn']}")
            print(f"✅ AWS Region: {os.getenv('AWS_REGION', 'us-east-1')}")
            return True
            
        except NoCredentialsError:
            print("❌ AWS credentials not found")
            return False
                
        except Exception as e:
            print(f"❌ AWS credential error: {str(e)}")
            return False
    
    def check_stack_status(self):
        """Check current stack status and handle errors"""
        try:
            response = self.cf_client.describe_stacks(StackName=self.stack_name)
            stack = response['Stacks'][0]
            status = stack['StackStatus']
            
            print(f"📋 Current stack status: {status}")
            
            if status in ['CREATE_FAILED', 'UPDATE_FAILED', 'ROLLBACK_COMPLETE']:
                print("🔧 Stack is in failed state, will attempt to fix...")
                return self.handle_failed_stack()
            elif status in ['CREATE_IN_PROGRESS', 'UPDATE_IN_PROGRESS']:
                print("⏳ Stack operation in progress, waiting...")
                return self.wait_for_stack_completion()
            elif status in ['CREATE_COMPLETE', 'UPDATE_COMPLETE']:
                print("✅ Stack is healthy")
                return True
            else:
                print(f"⚠️  Unknown stack status: {status}")
                return False
                
        except ClientError as e:
            if 'does not exist' in str(e):
                print("📋 Stack does not exist, will create new one")
                return True
            else:
                print(f"❌ Error checking stack: {str(e)}")
                return False
    
    def handle_failed_stack(self):
        """Handle failed stack by analyzing errors and taking corrective action"""
        print("🔍 Analyzing stack failure...")
        
        try:
            # Get stack events to understand the failure
            response = self.cf_client.describe_stack_events(StackName=self.stack_name)
            failed_events = [
                event for event in response['StackEvents']
                if event.get('ResourceStatus', '').endswith('_FAILED')
            ]
            
            if failed_events:
                print("❌ Failed resources:")
                for event in failed_events[:5]:  # Show last 5 failures
                    resource = event.get('LogicalResourceId', 'Unknown')
                    reason = event.get('ResourceStatusReason', 'No reason provided')
                    print(f"   {resource}: {reason}")
                
                # Check for common fixable issues
                if self.can_auto_fix_errors(failed_events):
                    print("🔧 Attempting automatic fix...")
                    return self.delete_and_recreate_stack()
                else:
                    print("⚠️  Manual intervention required")
                    return False
            else:
                print("🔧 No specific failure details, attempting stack recreation...")
                return self.delete_and_recreate_stack()
                
        except Exception as e:
            print(f"❌ Error analyzing stack failure: {str(e)}")
            return False
    
    def can_auto_fix_errors(self, failed_events):
        """Check if errors can be automatically fixed"""
        fixable_patterns = [
            'VALIDATION_FAILED',
            'ResponseHeaders',
            'extraneous key',
            'Properties validation failed'
        ]
        
        for event in failed_events:
            reason = event.get('ResourceStatusReason', '')
            if any(pattern in reason for pattern in fixable_patterns):
                print(f"✅ Found fixable error pattern: {reason}")
                return True
        
        return False
    
    def delete_and_recreate_stack(self):
        """Delete failed stack and recreate"""
        print("🗑️  Deleting failed stack...")
        
        try:
            self.cf_client.delete_stack(StackName=self.stack_name)
            
            # Wait for deletion
            print("⏳ Waiting for stack deletion...")
            waiter = self.cf_client.get_waiter('stack_delete_complete')
            waiter.wait(
                StackName=self.stack_name,
                WaiterConfig={'Delay': 15, 'MaxAttempts': 40}
            )
            
            print("✅ Stack deleted successfully")
            return True
            
        except Exception as e:
            print(f"❌ Error deleting stack: {str(e)}")
            return False
    
    def wait_for_stack_completion(self):
        """Wait for in-progress stack operation to complete"""
        try:
            print("⏳ Waiting for stack operation to complete...")
            
            # Check every 30 seconds for up to 30 minutes
            for i in range(60):
                response = self.cf_client.describe_stacks(StackName=self.stack_name)
                status = response['Stacks'][0]['StackStatus']
                
                if status.endswith('_COMPLETE'):
                    print(f"✅ Stack operation completed: {status}")
                    return True
                elif status.endswith('_FAILED'):
                    print(f"❌ Stack operation failed: {status}")
                    return False
                
                print(f"⏳ Still in progress: {status} ({i+1}/60)")
                time.sleep(30)
            
            print("⏰ Timeout waiting for stack completion")
            return False
            
        except Exception as e:
            print(f"❌ Error waiting for stack: {str(e)}")
            return False
    
    def create_lambda_package(self):
        """Create Lambda deployment package"""
        print("📦 Creating Lambda deployment package...")
        
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Copy Lambda function
                lambda_code_path = Path(__file__).parent.parent / 'python-backend' / 'src' / 'generate_design.py'
                if not lambda_code_path.exists():
                    raise FileNotFoundError(f"Lambda code not found: {lambda_code_path}")
                
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
                
        except Exception as e:
            print(f"❌ Error creating Lambda package: {str(e)}")
            return None
    
    def deploy_stack(self):
        """Deploy CloudFormation stack"""
        print("🚀 Deploying CloudFormation stack...")
        
        try:
            # Read template
            template_path = Path(__file__).parent / 'ai-merchandise-stack.yaml'
            with open(template_path, 'r') as f:
                template_body = f.read()
            
            # Parameters
            api_key = os.getenv('API_KEY', 'sk-ai-merchandise-2024-secure-key-xyz789')
            parameters = [
                {'ParameterKey': 'Environment', 'ParameterValue': self.environment},
                {'ParameterKey': 'ApiKeyValue', 'ParameterValue': api_key},
                {'ParameterKey': 'ShopifyDomain', 'ParameterValue': 'stylemytravel-dev.myshopify.com'}
            ]
            
            # Check if stack exists
            stack_exists = False
            try:
                self.cf_client.describe_stacks(StackName=self.stack_name)
                stack_exists = True
            except ClientError as e:
                if 'does not exist' not in str(e):
                    raise
            
            # Deploy
            if stack_exists:
                print("🔄 Updating existing stack...")
                self.cf_client.update_stack(
                    StackName=self.stack_name,
                    TemplateBody=template_body,
                    Parameters=parameters,
                    Capabilities=['CAPABILITY_NAMED_IAM']
                )
                waiter_name = 'stack_update_complete'
            else:
                print("🆕 Creating new stack...")
                self.cf_client.create_stack(
                    StackName=self.stack_name,
                    TemplateBody=template_body,
                    Parameters=parameters,
                    Capabilities=['CAPABILITY_NAMED_IAM'],
                    OnFailure='DELETE'  # Auto-cleanup on failure
                )
                waiter_name = 'stack_create_complete'
            
            # Wait for completion
            print("⏳ Waiting for deployment to complete...")
            waiter = self.cf_client.get_waiter(waiter_name)
            waiter.wait(
                StackName=self.stack_name,
                WaiterConfig={'Delay': 30, 'MaxAttempts': 60}
            )
            
            print("✅ Stack deployment completed!")
            return True
            
        except ClientError as e:
            if 'No updates are to be performed' in str(e):
                print("ℹ️  No updates needed")
                return True
            else:
                print(f"❌ Stack deployment failed: {str(e)}")
                return False
        except Exception as e:
            print(f"❌ Deployment error: {str(e)}")
            return False
    
    def update_lambda_code(self, zip_content):
        """Update Lambda function code"""
        function_name = f"ai-merchandise-design-generator-{self.environment}"
        print(f"🔄 Updating Lambda function: {function_name}")
        
        try:
            self.lambda_client.update_function_code(
                FunctionName=function_name,
                ZipFile=zip_content
            )
            print("✅ Lambda code updated!")
            return True
        except Exception as e:
            print(f"❌ Lambda update failed: {str(e)}")
            return False
    
    def get_stack_outputs(self):
        """Get and display stack outputs"""
        try:
            response = self.cf_client.describe_stacks(StackName=self.stack_name)
            stack = response['Stacks'][0]
            
            if 'Outputs' in stack:
                print("\n🎉 Deployment successful! Here are your endpoints:")
                print("=" * 60)
                for output in stack['Outputs']:
                    key = output['OutputKey']
                    value = output['OutputValue']
                    print(f"{key}: {value}")
                
                # Show API testing command
                api_url = None
                for output in stack['Outputs']:
                    if output['OutputKey'] == 'ApiGatewayUrl':
                        api_url = output['OutputValue']
                        break
                
                if api_url:
                    api_key = os.getenv('API_KEY', 'your-api-key')
                    print(f"\n🧪 Test your API:")
                    print(f"curl -X POST {api_url} \\")
                    print(f"  -H 'Content-Type: application/json' \\")
                    print(f"  -H 'X-Api-Key: {api_key}' \\")
                    print(f"  -d '{{\"prompt\": \"cute cat wearing sunglasses\", \"productType\": \"tshirt\"}}'")
                
                return True
            else:
                print("⚠️  No stack outputs found")
                return False
                
        except Exception as e:
            print(f"❌ Error getting outputs: {str(e)}")
            return False
    
    def run_deployment(self):
        """Main deployment orchestration"""
        print("🚀 AI Merchandise Platform - Auto Deployment")
        print("=" * 60)
        
        # Step 1: Check AWS credentials
        if not self.check_aws_credentials():
            print("❌ Cannot proceed without AWS credentials")
            return False
        
        # Step 2: Check stack status and handle issues
        if not self.check_stack_status():
            print("❌ Cannot proceed with unhealthy stack")
            return False
        
        # Step 3: Create Lambda package
        zip_content = self.create_lambda_package()
        if not zip_content:
            print("❌ Cannot proceed without Lambda package")
            return False
        
        # Step 4: Deploy stack
        if not self.deploy_stack():
            print("❌ Stack deployment failed")
            return False
        
        # Step 5: Update Lambda code
        if not self.update_lambda_code(zip_content):
            print("⚠️  Stack deployed but Lambda update failed")
        
        # Step 6: Show results
        self.get_stack_outputs()
        
        print("\n✅ Deployment completed successfully!")
        return True

def main():
    deployer = AutoDeployer()
    success = deployer.run_deployment()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()