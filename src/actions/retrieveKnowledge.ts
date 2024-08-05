import { ActionDefinition, ActionContext, OutputObject } from 'connery';
import { Client, iteratePaginatedAPI } from '@notionhq/client';
import axios from 'axios';
import { config } from 'dotenv';

config();

const pageId = process.env.NOTION_PAGE_ID;
const notionApiKey = process.env.NOTION_API_KEY;
const openAIApiKey = process.env.OPENAI_API_KEY;
const openAIModel = process.env.OPENAI_MODEL;

if (!pageId) {
  throw new Error('NOTION_PAGE_ID is not defined in the environment variables');
}

if (!notionApiKey) {
  throw new Error('NOTION_API_KEY is not defined in the environment variables');
}

if (!openAIApiKey) {
  throw new Error('OPENAI_API_KEY is not defined in the environment variables');
}

if (!openAIModel) {
  throw new Error('OPENAI_MODEL is not defined in the environment variables');
}

const notion = new Client({ auth: notionApiKey });

const fetchNotionAndAnswerQuestionAction: ActionDefinition = {
  key: 'retrieveKnowledge',
  name: 'Retrieve Knowledge',
  description: 'Receive answers and feedback to questions regarding your organization’s knowledge base stored in a Notion page;',
  type: 'read',
  inputParameters: [
    {
      key: 'question',
      name: 'Question',
      description: 'The question to query information from the Notion workspace',
      type: 'string',
      validation: {
        required: true,
      },
    },
  ],
  operation: {
    handler: fetchNotionAndAnswerQuestionHandler,
  },
  outputParameters: [
    {
      key: 'answer',
      name: 'Answer',
      type: 'string',
      validation: {
        required: true,
      },
    },
  ],
};

export default fetchNotionAndAnswerQuestionAction;

async function fetchNotionAndAnswerQuestionHandler({ input }: ActionContext): Promise<OutputObject> {
  const { question } = input;

  try {
    const blocks = await retrieveBlockChildren(pageId as string);
    const pageContent = blocks.map(getTextFromBlock).join('\n');

    const openAIResponse = await queryOpenAI(question, pageContent);

    if (openAIResponse) {
      return { answer: openAIResponse };
    } else {
      return { answer: 'The knowledge base does not provide a definitive answer to your question. Do you want to report missing content to admin?' };
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch and answer question: ${error.message}`);
  }
}

async function retrieveBlockChildren(id: string) {
  const blocks = [];

  for await (const block of iteratePaginatedAPI(notion.blocks.children.list, {
    block_id: id,
  })) {
    blocks.push(block);
  }

  return blocks;
}

const getPlainTextFromRichText = (richText: any) => {
  return richText.map((t: any) => t.plain_text).join('');
};

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

const getTextFromBlock = (block: any) => {
  let text;

  if (block[block.type].rich_text) {
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
          : 'Source sync block that another blocked is synced with.';
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

async function queryOpenAI(question: string, pageContent: string) {
  try {
    const systemPrompt = `
      You are a knowledge retrieval agent sourcing answers only from the provided knowledge base in Notion.
      Do not guess or use previous knowledge.
      If there are any disclaimers or indications in the content that it should not be shared with clients or is a work in progress, include that information only if it is explicitly mentioned.
    `;

    const userPrompt = `
      Based on the following Notion page content, answer the question: "${question}".
      If there are any disclaimers, particularly if the content should not be used in client communication or is a work in progress, please indicate explicitly only if it is mentioned in the content.
      Only answer based on the provided content. Do not use any prior knowledge.
      \n\n${pageContent}
    `;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: openAIModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt.trim(),
          },
          {
            role: 'user',
            content: userPrompt.trim(),
          },
        ],
        temperature: 0.2,
      },
      {
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const openAIContent = response.data.choices[0].message.content.trim();

      // Remove mention of disclaimers if there are none
      const disclaimerRegex = /Additionally, there are no disclaimers indicating that the content should not be used in client communication or that it is a work in progress\./g;
      const cleanedContent = openAIContent.replace(disclaimerRegex, '').trim();

      return cleanedContent;
    } else {
      return null;
    }
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`OpenAI API response error: ${error.response.status} ${error.response.statusText}`);
      console.error('Response data:', error.response.data);
      throw new Error(`Failed to query OpenAI: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
    } else {
      console.error('OpenAI API request error:', error.message);
      throw new Error(`Failed to query OpenAI: ${error.message}`);
    }
  }
}
