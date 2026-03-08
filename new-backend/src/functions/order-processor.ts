import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';

interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    properties: Array<{
      name: string;
      value: string;
    }>;
  }>;
  shipping_address: {
    first_name: string;
    last_name: string;
    address1: string;
    city: string;
    province: string;
    country: string;
    zip: string;
    phone: string;
  };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Shopify webhook received:', event.headers);

    // Verify webhook signature
    if (!verifyWebhookSignature(event)) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const order: ShopifyOrder = JSON.parse(event.body);
    console.log('Processing order:', order.id);

    // Process the order
    await processOrder(order);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Order processing error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

function verifyWebhookSignature(event: APIGatewayProxyEvent): boolean {
  const signature = event.headers['x-shopify-hmac-sha256'];
  const body = event.body;
  
  if (!signature || !body || !process.env.SHOPIFY_WEBHOOK_SECRET) {
    return false;
  }

  const calculatedSignature = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

async function processOrder(order: ShopifyOrder): Promise<void> {
  console.log(`Processing order ${order.id} for ${order.email}`);
  
  // Extract custom designs from line items
  const customItems = order.line_items.filter(item => 
    item.properties.some(prop => prop.name === 'design_url')
  );

  if (customItems.length === 0) {
    console.log('No custom items found in order');
    return;
  }

  // Process each custom item
  for (const item of customItems) {
    const designUrl = item.properties.find(prop => prop.name === 'design_url')?.value;
    
    if (designUrl) {
      console.log(`Processing custom item: ${item.title} with design: ${designUrl}`);
      
      // Here you would integrate with Shiprocket or your fulfillment provider
      await createFulfillmentOrder({
        orderId: order.id,
        itemId: item.id,
        designUrl,
        quantity: item.quantity,
        shippingAddress: order.shipping_address
      });
    }
  }
}

async function createFulfillmentOrder(params: {
  orderId: number;
  itemId: number;
  designUrl: string;
  quantity: number;
  shippingAddress: any;
}): Promise<void> {
  // Placeholder for Shiprocket integration
  console.log('Creating fulfillment order:', params);
  
  // TODO: Implement Shiprocket API integration
  // This would involve:
  // 1. Creating a Shiprocket order
  // 2. Uploading the design file
  // 3. Specifying print parameters
  // 4. Tracking the fulfillment status
}