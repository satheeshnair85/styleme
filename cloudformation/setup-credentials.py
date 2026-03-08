#!/usr/bin/env python3
"""
AWS Credentials Setup and Validation Helper
"""
import os
import boto3
from pathlib import Path
from botocore.exceptions import ClientError, NoCredentialsError

def test_credentials(access_key, secret_key, region='us-east-1'):
    """Test if AWS credentials are valid"""
    try:
        # Set temporary environment variables
        os.environ['AWS_ACCESS_KEY_ID'] = access_key
        os.environ['AWS_SECRET_ACCESS_KEY'] = secret_key
        os.environ['AWS_DEFAULT_REGION'] = region
        
        # Test credentials
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()
        
        print(f"✅ Credentials are valid!")
        print(f"   Account: {identity['Account']}")
        print(f"   User/Role: {identity['Arn']}")
        print(f"   Region: {region}")
        
        # Test Bedrock access
        bedrock = boto3.client('bedrock', region_name=region)
        try:
            bedrock.list_foundation_models()
            print(f"✅ Bedrock access confirmed")
        except Exception as e:
            print(f"⚠️  Bedrock access issue: {str(e)}")
        
        # Test S3 access
        s3 = boto3.client('s3', region_name=region)
        try:
            s3.list_buckets()
            print(f"✅ S3 access confirmed")
        except Exception as e:
            print(f"⚠️  S3 access issue: {str(e)}")
        
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'InvalidClientTokenId':
            print("❌ Invalid access key ID")
        elif error_code == 'SignatureDoesNotMatch':
            print("❌ Invalid secret access key")
        elif error_code == 'TokenRefreshRequired':
            print("❌ Credentials expired")
        else:
            print(f"❌ AWS Error: {error_code}")
        return False
        
    except Exception as e:
        print(f"❌ Error testing credentials: {str(e)}")
        return False

def update_env_file(access_key, secret_key, region='us-east-1'):
    """Update .env file with new credentials"""
    env_path = Path(__file__).parent.parent / '.env'
    
    if not env_path.exists():
        print("❌ .env file not found")
        return False
    
    # Read current .env file
    with open(env_path, 'r') as f:
        lines = f.readlines()
    
    # Update credentials
    updated_lines = []
    for line in lines:
        if line.startswith('AWS_ACCESS_KEY_ID='):
            updated_lines.append(f'AWS_ACCESS_KEY_ID={access_key}\n')
        elif line.startswith('AWS_SECRET_ACCESS_KEY='):
            updated_lines.append(f'AWS_SECRET_ACCESS_KEY={secret_key}\n')
        elif line.startswith('AWS_REGION='):
            updated_lines.append(f'AWS_REGION={region}\n')
        else:
            updated_lines.append(line)
    
    # Write back to file
    with open(env_path, 'w') as f:
        f.writelines(updated_lines)
    
    print(f"✅ Updated .env file: {env_path}")
    return True

def check_required_permissions():
    """Check if current credentials have required permissions"""
    required_services = {
        'CloudFormation': ['cloudformation:*'],
        'Lambda': ['lambda:*'],
        'API Gateway': ['apigateway:*'],
        'S3': ['s3:*'],
        'IAM': ['iam:CreateRole', 'iam:AttachRolePolicy', 'iam:PassRole'],
        'Bedrock': ['bedrock:InvokeModel'],
        'CloudWatch': ['logs:*']
    }
    
    print("\n🔍 Checking required permissions...")
    print("Note: This is a basic check. Some permissions might not be testable.")
    
    try:
        # Test CloudFormation
        cf = boto3.client('cloudformation')
        cf.list_stacks()
        print("✅ CloudFormation access")
        
        # Test Lambda
        lambda_client = boto3.client('lambda')
        lambda_client.list_functions()
        print("✅ Lambda access")
        
        # Test API Gateway
        apigw = boto3.client('apigateway')
        apigw.get_rest_apis()
        print("✅ API Gateway access")
        
        # Test IAM (limited)
        iam = boto3.client('iam')
        iam.get_user()
        print("✅ IAM access")
        
        print("\n💡 If deployment fails, you may need additional permissions.")
        print("   Consider using AdministratorAccess policy for initial setup.")
        
    except Exception as e:
        print(f"⚠️  Permission check failed: {str(e)}")

def main():
    """Main credential setup function"""
    print("🔐 AWS Credentials Setup Helper")
    print("=" * 50)
    
    # Check current credentials
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        print("📋 Current credentials from .env file:")
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('AWS_ACCESS_KEY_ID='):
                    current_key = line.split('=', 1)[1].strip()
                    print(f"   Access Key: {current_key[:8]}...{current_key[-4:]}")
                elif line.startswith('AWS_REGION='):
                    region = line.split('=', 1)[1].strip()
                    print(f"   Region: {region}")
        
        # Test current credentials
        print("\n🧪 Testing current credentials...")
        try:
            with open(env_path, 'r') as f:
                env_vars = {}
                for line in f:
                    if '=' in line and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        env_vars[key] = value
            
            if test_credentials(
                env_vars.get('AWS_ACCESS_KEY_ID', ''),
                env_vars.get('AWS_SECRET_ACCESS_KEY', ''),
                env_vars.get('AWS_REGION', 'us-east-1')
            ):
                check_required_permissions()
                print("\n🎉 Your credentials are working! You can proceed with deployment.")
                print("\nRun: python cloudformation/auto-deploy.py")
                return
        except Exception as e:
            print(f"❌ Error testing current credentials: {str(e)}")
    
    # Prompt for new credentials
    print("\n🔄 Let's set up new credentials:")
    print("1. Go to AWS Console → IAM → Users → [Your User] → Security credentials")
    print("2. Create new Access Key")
    print("3. Enter the credentials below:")
    
    access_key = input("\nEnter AWS Access Key ID: ").strip()
    secret_key = input("Enter AWS Secret Access Key: ").strip()
    region = input("Enter AWS Region (default: us-east-1): ").strip() or 'us-east-1'
    
    if not access_key or not secret_key:
        print("❌ Both Access Key ID and Secret Access Key are required")
        return
    
    # Test new credentials
    print(f"\n🧪 Testing new credentials...")
    if test_credentials(access_key, secret_key, region):
        # Update .env file
        if update_env_file(access_key, secret_key, region):
            check_required_permissions()
            print("\n🎉 Credentials updated successfully!")
            print("\nYou can now run: python cloudformation/auto-deploy.py")
        else:
            print("❌ Failed to update .env file")
    else:
        print("❌ New credentials are not valid")

if __name__ == "__main__":
    main()