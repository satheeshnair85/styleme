#!/usr/bin/env python3
"""
Deployment script for AI Merchandise Backend
"""
import os
import subprocess
import sys
from pathlib import Path

def run_command(command, cwd=None):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            check=True, 
            capture_output=True, 
            text=True,
            cwd=cwd
        )
        print(f"✅ {command}")
        if result.stdout:
            print(result.stdout)
        return result
    except subprocess.CalledProcessError as e:
        print(f"❌ {command}")
        print(f"Error: {e.stderr}")
        sys.exit(1)

def check_environment():
    """Check if required environment variables are set"""
    required_vars = [
        'AWS_REGION',
        'AWS_ACCESS_KEY_ID', 
        'AWS_SECRET_ACCESS_KEY',
        'S3_BUCKET_ANONYMOUS',
        'S3_BUCKET_USER',
        'API_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\nPlease set these variables in your .env file or environment")
        sys.exit(1)
    
    print("✅ Environment variables check passed")

def main():
    """Main deployment function"""
    print("🚀 Deploying AI Merchandise Backend (Python)")
    print("=" * 50)
    
    # Check environment
    check_environment()
    
    # Get current directory
    backend_dir = Path(__file__).parent
    
    # Install Node.js dependencies (for Serverless Framework)
    print("\n📦 Installing Node.js dependencies...")
    run_command("npm install", cwd=backend_dir)
    
    # Deploy using Serverless Framework
    stage = os.getenv('STAGE', 'dev')
    print(f"\n🚀 Deploying to stage: {stage}")
    run_command(f"npx serverless deploy --stage {stage}", cwd=backend_dir)
    
    print("\n✅ Deployment completed successfully!")
    print("\n📋 Next steps:")
    print("1. Note the API Gateway endpoint URL from the output above")
    print("2. Update your Shopify theme to use the new endpoint")
    print("3. Test the design generation functionality")

if __name__ == "__main__":
    main()