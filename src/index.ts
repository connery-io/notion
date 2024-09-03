import { PluginDefinition, setupPluginServer } from 'connery';
import askMyKnowledgePublicNotion from "./actions/AskMyKnowledgeFromPublicNotionPage.js";
import askMyKnowledgePrivateNotion from "./actions/AskMyKnowledgeFromPrivateNotionPage.js";

const pluginDefinition: PluginDefinition = {
  name: 'Notion',
  description: 'This plugin enables interaction with Notion-based knowledge repositories, allowing users to query and retrieve answers from both public and private Notion pages. Using the Connery platform, requests get securely logged, allowing for later analysis to identify gaps and opportunities to improve both the knowledge base and the action setup itself. This ensures that your knowledge management processes can be continuously refined over time.The plugin integrates with OpenAI to provide high-certainty answers based on the content available in Notion and suggests follow-ups in case of missing content.',
  actions: [askMyKnowledgePublicNotion, askMyKnowledgePrivateNotion],
};

const handler = await setupPluginServer(pluginDefinition);
export default handler;
