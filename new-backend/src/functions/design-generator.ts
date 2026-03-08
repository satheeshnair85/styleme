import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

interface GenerateDesignRequest {
  prompt: string;
  productType: string;
  style?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Design generation request:', event.body);

    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Request body is required'
        })
      };
    }

    const request: GenerateDesignRequest = JSON.parse(event.body);
    
    if (!request.prompt || !request.productType) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Prompt and productType are required'
        })
      };
    }

    // Generate design using Bedrock
    const designUrl = await generateDesignWithBedrock(request);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {
          designUrl,
          designId: uuidv4()
        }
      })
    };

  } catch (error) {
    console.error('Design generation error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};

async function generateDesignWithBedrock(request: GenerateDesignRequest): Promise<string> {
  // Optimize prompt for the product type
  const optimizedPrompt = optimizePromptForProduct(request.prompt, request.productType);
  
  const modelId = 'stability.stable-diffusion-xl-v1';
  const params = {
    modelId,
    body: JSON.stringify({
      text_prompts: [
        {
          text: optimizedPrompt,
          weight: 1
        }
      ],
      cfg_scale: 7,
      steps: 50,
      seed: Math.floor(Math.random() * 1000000),
      width: 1024,
      height: 1024
    })
  };

  const command = new InvokeModelCommand(params);
  const response = await bedrockClient.send(command);
  
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const imageBase64 = responseBody.artifacts[0].base64;
  
  // Upload to S3
  const designId = uuidv4();
  const s3Key = `designs/${designId}.png`;
  
  const uploadCommand = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    Body: Buffer.from(imageBase64, 'base64'),
    ContentType: 'image/png'
  });
  
  await s3Client.send(uploadCommand);
  
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

function optimizePromptForProduct(prompt: string, productType: string): string {
  const basePrompt = prompt;
  
  switch (productType.toLowerCase()) {
    case 'tshirt':
      return `${basePrompt}, t-shirt design, graphic design, vector art, clean design, high contrast, suitable for printing`;
    case 'mug':
      return `${basePrompt}, mug design, wraparound design, coffee mug art, printable design`;
    case 'cap':
      return `${basePrompt}, cap design, hat design, embroidery style, simple design, logo style`;
    case 'sticker':
      return `${basePrompt}, sticker design, die-cut sticker, vibrant colors, simple design`;
    default:
      return `${basePrompt}, product design, printable design, high quality`;
  }
}