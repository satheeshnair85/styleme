#!/usr/bin/env python3
"""
Test script for the AI Design Generation API
"""
import json
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../.env')

def test_generate_design(api_url, api_key):
    """Test the design generation endpoint"""
    
    # Test data
    test_data = {
        "prompt": "A cute cartoon cat wearing sunglasses",
        "productType": "tshirt",
        "style": "standard",
        "userId": "test-user-123"  # Optional - remove for anonymous
    }
    
    headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': api_key
    }
    
    print("🧪 Testing Design Generation API")
    print(f"URL: {api_url}")
    print(f"Payload: {json.dumps(test_data, indent=2)}")
    print("-" * 50)
    
    try:
        response = requests.post(
            api_url,
            json=test_data,
            headers=headers,
            timeout=120  # 2 minutes timeout for image generation
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(f"Response: {json.dumps(result, indent=2)}")
            
            if result.get('success') and result.get('data', {}).get('designUrl'):
                design_url = result['data']['designUrl']
                print(f"\n🎨 Generated Design URL: {design_url}")
                print("You can open this URL in a browser to view the generated image")
                
        else:
            print("❌ Error!")
            print(f"Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out (this is normal for image generation)")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {str(e)}")

def test_cors_preflight(api_url):
    """Test CORS preflight request"""
    print("\n🌐 Testing CORS Preflight")
    print("-" * 30)
    
    try:
        response = requests.options(
            api_url,
            headers={
                'Origin': 'https://stylemytravel-dev.myshopify.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type,X-Api-Key'
            }
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"CORS Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("✅ CORS preflight successful")
        else:
            print("❌ CORS preflight failed")
            
    except Exception as e:
        print(f"❌ CORS test failed: {str(e)}")

def main():
    """Main test function"""
    # Get configuration
    api_key = os.getenv('API_KEY')
    
    if not api_key:
        print("❌ API_KEY not found in environment variables")
        print("Please set API_KEY in your .env file")
        return
    
    # You'll need to replace this with your actual API Gateway URL after deployment
    api_url = input("Enter your API Gateway URL (e.g., https://abc123.execute-api.us-east-1.amazonaws.com/dev/generate-design): ").strip()
    
    if not api_url:
        print("❌ API URL is required")
        return
    
    # Run tests
    test_cors_preflight(api_url)
    test_generate_design(api_url, api_key)

if __name__ == "__main__":
    main()