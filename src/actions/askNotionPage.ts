import { ActionDefinition, ActionContext, OutputObject } from 'connery';
import { Client, iteratePaginatedAPI, isFullBlock } from '@notionhq/client'; // Import Client and types from Notion

const actionDefinition: ActionDefinition = {
  key: 'askNotionPage',
  name: 'Get Notion Page Content',
  description:
    'This action retrieves the content of a Notion page using its URL and the Notion API. It can optionally include instructions before the page content. The action required the Notion page URL and Notion API key connected to this URL. It fetches all content elements including text, media, and toggles, and returns the page content as a single string. It does not extract content form inline DBs.',
  type: 'read',
  inputParameters: [
    {
      key: 'notionPageUrl',
      name: 'Notion Page URL',
      description: 'The URL of the private Notion page to fetch content from.',
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
      key: 'instructions',
      name: 'Instructions',
      description: 'Optional instructions for content processing.',
      type: 'string',
      validation: {
        required: false,
      },
    },
  ],
  operation: {
    handler: handler,
  },
  outputParameters: [
    {
      key: 'notionContent',
      name: 'Notion Content',
      type: 'string',
      validation: {
        required: true,
      },
    },
  ],
};

export default actionDefinition;

export async function handler({ input }: ActionContext): Promise<OutputObject> {
  try {
    // Extract the page ID from the provided Notion URL
    const notionPageId = extractPageIdFromUrl(input.notionPageUrl);

    // Initialize the Notion client
    const notion = new Client({ auth: input.notionApiKey });

    // Retrieve all blocks of the Notion page
    const blocks = await retrieveBlockChildren(notion, notionPageId);

    // Process the blocks to get the content as a single string
    const pageContent = blocks.map(getTextFromBlock).join('\n');

    // Check if the content length is less than 5 characters
    if (pageContent.length < 5) {
      throw new Error(
        `The extracted content is too short: ${pageContent.length} characters. It must be at least 5 characters long.`,
      );
    }

    // Prepare the output based on whether instructions are provided
    let output: string;
    if (input.instructions) {
      output = `Follow these instructions: ${input.instructions}\nContent: ${pageContent}`;
    } else {
      output = pageContent;
    }

    // Return the formatted output
    return { notionContent: output };
  } catch (error: any) {
    console.error('An error occurred:', (error as Error).message);
    throw new Error(`Error occurred: ${(error as Error).message}`);
  }
}

// Helper function to retrieve all blocks from a Notion page using pagination. Recursively fetches child blocks if they exist.
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

// Helper function to extract plain text from a rich text object in Notion. Combines all pieces of text within a block into a single string.
const getPlainTextFromRichText = (richText: any) => {
  return richText.map((t: any) => t.plain_text).join('');
};

// Helper function to convert a Notion block into a string representation. Handles various block types, including media, tables, and text blocks.
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

//Helper function to extract the source text of media blocks, such as images or videos, including any associated captions.
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

// Helper function to extract the Notion page ID from the provided URL. The function uses a regular expression to identify and return the page ID.
function extractPageIdFromUrl(url: string): string {
  const regex = /([a-f0-9]{32})|([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;
  const match = url.match(regex);
  if (!match) {
    throw new Error('Invalid Notion page URL');
  }
  return match[0].replace(/-/g, ''); // Return the page ID without dashes
}
