import { ActionDefinition, ActionContext, OutputObject } from 'connery';
import { Client, iteratePaginatedAPI, isFullBlock } from '@notionhq/client'; // Import Client and types from Notion
import OpenAI from 'openai';

const actionDefinition: ActionDefinition = {
  key: 'askPrivateNotionPage',
  name: 'Ask Private Notion Page',
  description:
    'This action enables users to ask questions and receive answers from a knowledge base hosted on a private Notion page. The action accesses the Notion page via its URL using the Notion API and an API key. Users’ questions are processed by OpenAI, which generates answers based on the content retrieved from the page. The action supports all content elements, including toggles.',
  type: 'read',
  inputParameters: [
    {
      key: 'notionPageUrl',
      name: 'Notion Page URL',
      description: 'The URL of the private Notion page to fetch knowledge content from.',
      type: 'string',
      validation: {
        required: true,
      },
    },
    {
      key: 'notionApiKey',
      name: 'Notion API Key',
      description: 'API key to authenticate with the Notion API',
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
      description: 'The model to use for generating the answer (e.g. gpt-4-turbo, gpt-4o-mini, etc.).',
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
  const { notionPageUrl, notionApiKey, question, openaiApiKey, openaiModel } = input;

  try {
    // Extract the page ID from the provided Notion URL
    const notionPageId = extractPageIdFromUrl(notionPageUrl);

    // Initialize the Notion client
    const notion = new Client({ auth: notionApiKey });

    // Retrieve all blocks of the Notion page
    const blocks = await retrieveBlockChildren(notion, notionPageId);

    // Process the blocks to get the content as a single string
    const pageContent = blocks.map(getTextFromBlock).join('\n');

    // Log the extracted Notion content length
    console.log("Extracted Notion content length:", pageContent.length, "characters");
    console.log("Extracted Notion content:", pageContent);

    // Check if the content length is less than 5 characters
    if (pageContent.length < 5) {
      throw new Error(`The extracted content is too short: ${pageContent.length} characters. It must be at least 5 characters long.`);
    }

    // Initialize OpenAI with the provided API key
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Create the system message with instructions for the model
    const systemMessage = `You are an FAQ expert. When asked a question or given a request related to a specific topic, you provide an accurate and concise answer based strictly on the content provided. 
    You respond in the same language as the user’s input and adjust your answer to fit the context of the request, whether it’s a direct question or an indirect inquiry.
    You never guess or paraphrase — only answer if the explicit content for that request is available. 
    If there are any disclaimers or indications in the content that it should not be shared with clients or is a work in progress, include that information only if it is explicitly mentioned. 
    Here is the content you should use to generate your answer:
    ”${pageContent}”
    `;
    
    // Set the user's question separately
    const userQuestion = `Based on this content, please respond to the following request or question with high confidence:
    ”${question}”. 
    If you are not confident that the content fully addresses the request, respond with: 
    ‘My content source does not provide enough context to answer your request. If you want to report this knowledge gap to the admin, just trigger another action with “Report knowledge gap:” and add your original request.’
    `;
    
    // Request completion from OpenAI using the specified model
    const response = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userQuestion },
      ],
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

    const answer = messageContent.trim();

    // Return the model's answer directly
    return { textResponse: answer };
  } catch (error: any) {
    console.error('An error occurred:', (error as Error).message);
    throw new Error(`Error occurred: ${(error as Error).message}`);
  }
}

/**
 * Helper function to retrieve all blocks from a Notion page using pagination.
 * Recursively fetches child blocks if they exist.
 */
async function retrieveBlockChildren(notion: Client, id: string) {
  const blocks: Array<any> = [];
  for await (const block of iteratePaginatedAPI(notion.blocks.children.list, { block_id: id })) {
    blocks.push(block);

    // Recursively fetch and process child blocks if the block has children
    if (isFullBlock(block) && block.has_children) {
      const childBlocks = await retrieveBlockChildren(notion, block.id);
      blocks.push(...childBlocks); // Add child blocks to the main block array
    }
  }
  return blocks;
}

/**
 * Helper function to extract plain text from a rich text object in Notion.
 * Combines all pieces of text within a block into a single string.
 */
const getPlainTextFromRichText = (richText: any) => {
  return richText.map((t: any) => t.plain_text).join('');
};

/**
 * Helper function to convert a Notion block into a string representation.
 * Handles various block types, including media, tables, and text blocks.
 */
const getTextFromBlock = (block: any) => {
  let text;

  if (block[block.type]?.rich_text) {
    text = getPlainTextFromRichText(block[block.type].rich_text);
  } else {
    switch (block.type) {
      case 'unsupported':
        text = '[Unsupported block type]';
        break;
      case 'bookmark':
        text = block.bookmark.url;
        break;
      case 'child_database':
        text = block.child_database.title;
        break;
      case 'child_page':
        text = block.child_page.title;
        break;
      case 'embed':
      case 'video':
      case 'file':
      case 'image':
      case 'pdf':
        text = getMediaSourceText(block);
        break;
      case 'equation':
        text = block.equation.expression;
        break;
      case 'link_preview':
        text = block.link_preview.url;
        break;
      case 'synced_block':
        text = block.synced_block.synced_from
          ? 'This block is synced with a block with the following ID: ' +
            block.synced_block.synced_from[block.synced_block.synced_from.type]
          : 'Source sync block that another block is synced with.';
        break;
      case 'table':
        text = 'Table width: ' + block.table.table_width;
        break;
      case 'table_of_contents':
        text = 'ToC color: ' + block.table_of_contents.color;
        break;
      case 'breadcrumb':
      case 'column_list':
      case 'divider':
        text = 'No text available';
        break;
      default:
        text = '[Needs case added]';
        break;
    }
  }

  if (block.has_children) {
    text = text + ' (Has children)';
  }

  return block.type + ': ' + text;
};

/**
 * Helper function to extract the source text of media blocks, such as images or videos,
 * including any associated captions.
 */
const getMediaSourceText = (block: any) => {
  let source, caption;

  if (block[block.type].external) {
    source = block[block.type].external.url;
  } else if (block[block.type].file) {
    source = block[block.type].file.url;
  } else if (block[block.type].url) {
    source = block[block.type].url;
  } else {
    source = '[Missing case for media block types]: ' + block.type;
  }

  if (block[block.type].caption.length) {
    caption = getPlainTextFromRichText(block[block.type].caption);
    return caption + ': ' + source;
  }

  return source;
};

/**
 * Helper function to extract the Notion page ID from the provided URL.
 * The function uses a regular expression to identify and return the page ID.
 */
function extractPageIdFromUrl(url: string): string {
  const regex = /([a-f0-9]{32})|([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;
  const match = url.match(regex);
  if (!match) {
    throw new Error('Invalid Notion page URL');
  }
  return match[0].replace(/-/g, ''); // Return the page ID without dashes
}