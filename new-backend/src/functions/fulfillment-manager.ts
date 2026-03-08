import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface FulfillmentStatusUpdate {
  orderId: string;
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Fulfillment status update:', event.body);

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const update: FulfillmentStatusUpdate = JSON.parse(event.body);
    
    // Process the fulfillment status update
    await processFulfillmentUpdate(update);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Fulfillment processing error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function processFulfillmentUpdate(update: FulfillmentStatusUpdate): Promise<void> {
  console.log(`Processing fulfillment update for order ${update.orderId}`);
  
  // Map fulfillment status to Shopify status
  const shopifyStatus = mapFulfillmentStatus(update.status);
  
  // Update Shopify order status
  await updateShopifyOrder(update.orderId, {
    status: shopifyStatus,
    trackingNumber: update.trackingNumber,
    trackingUrl: update.trackingUrl
  });
  
  // Send customer notification if needed
  if (update.trackingNumber) {
    await sendTrackingNotification(update.orderId, update.trackingNumber, update.trackingUrl);
  }
}

function mapFulfillmentStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': 'pending',
    'processing': 'partial',
    'shipped': 'fulfilled',
    'delivered': 'fulfilled',
    'cancelled': 'cancelled'
  };
  
  return statusMap[status.toLowerCase()] || 'pending';
}

async function updateShopifyOrder(orderId: string, update: {
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
}): Promise<void> {
  // Placeholder for Shopify API integration
  console.log(`Updating Shopify order ${orderId}:`, update);
  
  // TODO: Implement Shopify Admin API integration
  // This would involve:
  // 1. Authenticating with Shopify Admin API
  // 2. Updating the order fulfillment status
  // 3. Adding tracking information
}

async function sendTrackingNotification(
  orderId: string, 
  trackingNumber: string, 
  trackingUrl?: string
): Promise<void> {
  console.log(`Sending tracking notification for order ${orderId}: ${trackingNumber}`);
  
  // TODO: Implement customer notification
  // This could be:
  // 1. Email notification
  // 2. SMS notification
  // 3. Push notification
  // 4. Update in customer portal
}