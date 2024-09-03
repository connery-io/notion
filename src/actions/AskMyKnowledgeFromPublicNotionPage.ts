import puppeteer from 'puppeteer';
import { ActionDefinition, ActionContext, OutputObject } from 'connery';
import OpenAI from 'openai';
import { askModel } from '../shared/shared.js';

const actionDefinition: ActionDefinition = {
  key: 'askMyPublicNotionPage',
  name: 'Ask my Knowledge from Public Notion Page',
  description:
    'This action enables users to ask questions and receive answers from a knowledge base hosted on a public Notion page. The action accesses the Notion page via its URL without requiring any authorization. Users’ questions are processed by OpenAI, which generates answers only if the content’s relevance is deemed to have high certainty. If no satisfactory answer is found, the action suggests a follow-up to report the missing content. Note: This action can only process Notion pages that do not use toggle elements.',
  type: 'read',
  inputParameters: [
    {
      key: 'notionPageUrl',
      name: 'Notion Page URL',
      description: 'The URL of the public Notion page to fetch knowledge content from.',
      type: 'string',
      validation: {
        required: true,
      },
    },
    {
      key: 'question',
      name: 'User Question',
      description: 'The question asked by the user about the particular knowledge base.',
      type: 'string',
      validation: {
        required: true,
      },
    },
    {
      key: 'openaiApiKey',
      name: 'OpenAI API Key',
      description: 'API key to authenticate with OpenAI',
      type: 'string',
      validation: {
        required: true,
      },
    },
    {
      key: 'openaiModel',
      name: 'OpenAI Model',
      description: 'The model to use for generating the answer (e.g., gpt-3.5-turbo, gpt-4-turbo, gpt-4o-mini, etc.).',
      type: 'string',
      validation: {
        required: true,
      },
    },
  ],
  operation: {
    handler: handler,
  },
  outputParameters: [
    {
      key: 'textResponse',
      name: 'Text response',
      type: 'string',
      validation: {
        required: true,
      },
    },
  ],
};

export default actionDefinition;

export async function handler({ input }: ActionContext): Promise<OutputObject> {
  const { notionPageUrl, question, openaiApiKey, openaiModel } = input;

  try {
    // Fetch and render the Notion page content using Puppeteer
    const notionContent = await fetchNotionContentWithPuppeteer(notionPageUrl);

    // Log the extracted Notion content length
    console.log('Extracted Notion content length:', notionContent.length, 'characters');

    // Initialize OpenAI with the provided API key
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Create the prompt with instructions for the model
    const prompt = `You are an FAQ expert. When asked a question or given a request related to a specific topic, you provide an accurate and concise answer based strictly on the content provided. You respond in the same language as the user’s input and adjust your answer to fit the context of the request, whether it’s a direct question or an indirect inquiry. You never guess or paraphrase — only answer if the explicit content for that request is available. Here is the content you should use to generate your answer:\n\n”${notionContent}”\n\nBased on this content, please respond to the following request or question with high confidence:\n\n”${question}”. If you are not confident that the content fully addresses the request, respond with: ‘My content source does not provide enough context to answer your request. If you want to report this knowledge gap to the admin, just trigger another action with “Report knowledge gap:” and add your original request.`;

    // Request completion from OpenAI using the specified model
    const response = await openai.chat.completions.create({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
    });

    // Log and handle the response
    if (!response.choices || response.choices.length === 0) {
      console.error('Model did not respond with any choices.');
      throw new Error('Model did not respond.');
    }

    const messageContent = response.choices[0].message.content;

    if (messageContent === null || messageContent.trim().length === 0) {
      console.error("Model's answer length is too short.");
      throw new Error("Model's answer is too short.");
    }

    console.log('Model output length:', messageContent.length, 'characters');

    const answer = messageContent.trim();

    // Return the model's answer directly
    return { textResponse: answer };
  } catch (error) {
    console.error('An error occurred:', (error as Error).message);
    throw new Error(`Error occurred: ${(error as Error).message}`);
  }
}

// Helper function to extract content using Puppeteer
async function fetchNotionContentWithPuppeteer(url: string): Promise<string> {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Extract text from the page
    const content = await page.evaluate(() => {
      return document.body.innerText;
    });

    await browser.close();

    return content;
  } catch (error) {
    console.error('Failed to fetch Notion page:', (error as Error).message);
    throw new Error('Notion page not available.');
  }
}
