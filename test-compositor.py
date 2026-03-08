#!/usr/bin/env python3
"""
Test the compositor API
"""
import requests
import json

# Test with a sample design URL
test_payload = {
    "designUrl": "https://ai-merchandise-anonymous-dev-381492244990.s3.amazonaws.com/designs/20260308_155045_d4c8b9f8.png",
    "productType": "tshirt",
    "mockupUrl": None  # Will use blank mockup
}

print("Testing Compositor API...")
print(f"Payload: {json.dumps(test_payload, indent=2)}")

response = requests.post(
    'https://letb0j7l89.execute-api.us-east-1.amazonaws.com/dev/composite-design',
    headers={
        'Content-Type': 'application/json',
        'X-Api-Key': 'sk-ai-merchandise-2024-secure-key-xyz789'
    },
    json=test_payload
)

print(f"\nStatus Code: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")
