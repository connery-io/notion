import { PluginDefinition, setupPluginServer } from 'connery';
import askMyKnowledgePublicNotion from './actions/AskMyKnowledgeFromPublicNotionPage.js';
import askMyKnowledgePrivateNotion from './actions/AskMyKnowledgeFromPrivateNotionPage.js';

const pluginDefinition: PluginDefinition = {
  name: 'Notion',
  description:
    'This plugin enables interaction with Notion-based knowledge repositories, allowing users to query and retrieve answers from both public and private Notion pages. The plugin integrates with OpenAI to provide high-certainty answers based on the content available in Notion and suggests follow-ups in case of missing content.',
  actions: [askMyKnowledgePublicNotion, askMyKnowledgePrivateNotion],
};

const handler = await setupPluginServer(pluginDefinition);
export default handler;
