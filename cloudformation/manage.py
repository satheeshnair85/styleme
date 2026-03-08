#!/usr/bin/env python3
"""
Management script for AI Merchandise Platform
"""
import os
import sys
import boto3
from pathlib import Path
from botocore.exceptions import ClientError

def load_env_file():
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

def check_aws_credentials():
    """Check if AWS credentials are configured"""
    try:
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        print(f"✅ AWS Account: {identity['Account']}")
        print(f"✅ AWS User/Role: {identity['Arn']}")
        return True
    except Exception as e:
        print(f"❌ AWS credentials not configured: {str(e)}")
        return False

def check_stack_status(stack_name):
    """Check CloudFormation stack status"""
    cf = boto3.client('cloudformation')
    try:
        response = cf.describe_stacks(StackName=stack_name)
        stack = response['Stacks'][0]
        status = stack['StackStatus']
        print(f"📋 Stack Status: {status}")
        
        if 'Outputs' in stack:
            print("📋 Stack Outputs:")
            for output in stack['Outputs']:
                print(f"   {output['OutputKey']}: {output['OutputValue']}")
        
        return status
    except ClientError as e:
        if 'does not exist' in str(e):
            print("📋 Stack does not exist")
            return None
        else:
            print(f"❌ Error checking stack: {str(e)}")
            return None

def list_s3_buckets():
    """List S3 buckets"""
    s3 = boto3.client('s3')
    try:
        response = s3.list_buckets()
        print("🪣 S3 Buckets:")
        for bucket in response['Buckets']:
            if 'ai-merchandise' in bucket['Name']:
                print(f"   {bucket['Name']} (Created: {bucket['CreationDate']})")
    except Exception as e:
        print(f"❌ Error listing buckets: {str(e)}")

def test_lambda_function(function_name):
    """Test Lambda function"""
    lambda_client = boto3.client('lambda')
    try:
        # Test payload
        test_event = {
            "httpMethod": "POST",
            "headers": {
                "X-Api-Key": os.getenv('API_KEY', 'test-key')
            },
            "body": '{"prompt": "test image", "productType": "tshirt"}'
        }
        
        print(f"🧪 Testing Lambda function: {function_name}")
        response = lambda_client.invoke(
            FunctionName=function_name,
            InvocationType='RequestResponse',
            Payload=str(test_event).encode()
        )
        
        print(f"✅ Lambda invocation successful")
        print(f"Status Code: {response['StatusCode']}")
        
        if 'Payload' in response:
            import json
            payload = json.loads(response['Payload'].read())
            print(f"Response: {json.dumps(payload, indent=2)}")
        
    except Exception as e:
        print(f"❌ Lambda test failed: {str(e)}")

def show_costs():
    """Show estimated AWS costs"""
    print("💰 Estimated Monthly Costs (USD):")
    print("   Lambda (1000 requests/month): ~$0.20")
    print("   API Gateway (1000 calls/month): ~$0.004")
    print("   S3 Storage (1GB): ~$0.023")
    print("   Bedrock Nova Canvas (100 images): ~$4.00")
    print("   CloudWatch Logs: ~$0.50")
    print("   Total estimated: ~$4.75/month for light usage")

def main():
    """Main management function"""
    print("🛠️  AI Merchandise Platform Management")
    print("=" * 50)
    
    # Load environment
    load_env_file()
    
    # Check AWS credentials
    if not check_aws_credentials():
        print("\n💡 To configure AWS credentials:")
        print("   aws configure")
        print("   or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
        return
    
    stack_name = 'ai-merchandise-platform-dev'
    
    while True:
        print("\n🔧 Available Actions:")
        print("1. 🚀 Deploy stack")
        print("2. 🔄 Update Lambda code only")
        print("3. 📋 Check stack status")
        print("4. 🪣 List S3 buckets")
        print("5. 🧪 Test Lambda function")
        print("6. 💰 Show cost estimates")
        print("7. 🗑️  Delete stack")
        print("8. 🚪 Exit")
        
        choice = input("\nEnter your choice (1-8): ").strip()
        
        if choice == '1':
            print("\n🚀 Deploying stack...")
            os.system(f'python {Path(__file__).parent}/deploy.py --action deploy')
            
        elif choice == '2':
            print("\n🔄 Updating Lambda code...")
            os.system(f'python {Path(__file__).parent}/deploy.py --action update-code')
            
        elif choice == '3':
            print(f"\n📋 Checking stack status: {stack_name}")
            check_stack_status(stack_name)
            
        elif choice == '4':
            print("\n🪣 Listing S3 buckets...")
            list_s3_buckets()
            
        elif choice == '5':
            function_name = 'ai-merchandise-design-generator-dev'
            test_lambda_function(function_name)
            
        elif choice == '6':
            print("\n💰 Cost Estimates:")
            show_costs()
            
        elif choice == '7':
            confirm = input(f"\n⚠️  Are you sure you want to delete {stack_name}? (yes/no): ")
            if confirm.lower() == 'yes':
                os.system(f'python {Path(__file__).parent}/deploy.py --action delete')
            else:
                print("❌ Deletion cancelled")
                
        elif choice == '8':
            print("👋 Goodbye!")
            break
            
        else:
            print("❌ Invalid choice. Please try again.")

if __name__ == "__main__":
    main()