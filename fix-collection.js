require('dotenv').config();
const https = require('https');

// Disable TLS certificate validation for local development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('Setting featured image for T-shirt product...');

const productId = '8082893504605';

// First get the product to see its images
function getProduct() {
  const options = {
    hostname: 'stylemytravel-dev.myshopify.com',
    path: `/admin/api/2023-10/products/${productId}.json`,
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.product) {
          const product = response.product;
          console.log(`Product: ${product.title}`);
          console.log(`Current featured image: ${product.featured_image ? 'SET' : 'NOT SET'}`);
          console.log(`Total images: ${product.images.length}`);
          
          if (product.images.length > 0 && !product.featured_image) {
            console.log('Setting first image as featured image...');
            setFeaturedImage(product.images[0].id);
          } else if (product.featured_image) {
            console.log('✅ Featured image already set!');
            console.log('Featured image URL:', product.featured_image.src);
          } else {
            console.log('❌ No images found for this product');
          }
        } else {
          console.log('❌ Error getting product:', response);
        }
      } catch (e) {
        console.log('❌ Error parsing product:', e.message);
      }
    });
  });

  req.on('error', (e) => console.log('Request error:', e.message));
  req.end();
}

function setFeaturedImage(imageId) {
  const updateData = JSON.stringify({
    product: {
      id: parseInt(productId),
      featured_image: {
        id: imageId
      }
    }
  });

  const options = {
    hostname: 'stylemytravel-dev.myshopify.com',
    path: `/admin/api/2023-10/products/${productId}.json`,
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(updateData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.product && response.product.featured_image) {
          console.log('✅ SUCCESS: Featured image set!');
          console.log('Featured image URL:', response.product.featured_image.src);
          console.log('Image ID:', response.product.featured_image.id);
        } else {
          console.log('❌ Error setting featured image:', response);
        }
      } catch (e) {
        console.log('❌ Error parsing update response:', e.message);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => console.log('Update request error:', e.message));
  req.write(updateData);
  req.end();
}

getProduct();