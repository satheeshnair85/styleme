#!/usr/bin/env python3
"""
Update existing CloudFormation stack
"""
import boto3
import sys
import time

def update_stack():
    """Update CloudFormation stack"""
    cf_client = boto3.client('cloudformation', region_name='us-east-1')
    
    stack_name = 'ai-merchandise-platform-dev'
    
    print("=" * 60)
    print("🔄 Updating AI Merchandise Platform Stack")
    print("=" * 60)
    
    # Read template
    with open('ai-merchandise-stack.yaml', 'r') as f:
        template_body = f.read()
    
    try:
        print(f"\n📝 Updating stack: {stack_name}")
        
        response = cf_client.update_stack(
            StackName=stack_name,
            TemplateBody=template_body,
            Parameters=[
                {'ParameterKey': 'Environment', 'UsePreviousValue': True},
                {'ParameterKey': 'ApiKeyValue', 'UsePreviousValue': True},
                {'ParameterKey': 'ShopifyDomain', 'UsePreviousValue': True}
            ],
            Capabilities=['CAPABILITY_NAMED_IAM']
        )
        
        stack_id = response['StackId']
        print(f"✅ Stack update initiated: {stack_id}")
        
        # Wait for update to complete
        print("\n⏳ Waiting for stack update to complete...")
        waiter = cf_client.get_waiter('stack_update_complete')
        
        try:
            waiter.wait(
                StackName=stack_name,
                WaiterConfig={'Delay': 10, 'MaxAttempts': 60}
            )
            print("✅ Stack update completed successfully!")
            
            # Get outputs
            stack = cf_client.describe_stacks(StackName=stack_name)['Stacks'][0]
            outputs = {o['OutputKey']: o['OutputValue'] for o in stack.get('Outputs', [])}
            
            print("\n" + "=" * 60)
            print("📋 Stack Outputs:")
            print("=" * 60)
            for key, value in outputs.items():
                print(f"{key}: {value}")
            
            return True
            
        except Exception as e:
            print(f"❌ Stack update failed: {str(e)}")
            return False
            
    except cf_client.exceptions.ClientError as e:
        error_message = e.response['Error']['Message']
        if 'No updates are to be performed' in error_message:
            print("ℹ️  No changes detected - stack is already up to date")
            return True
        else:
            print(f"❌ Error updating stack: {error_message}")
            return False

if __name__ == '__main__':
    success = update_stack()
    sys.exit(0 if success else 1)
