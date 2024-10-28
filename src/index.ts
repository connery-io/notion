import { PluginDefinition, setupPluginServer } from 'connery';
import getNotionPageContent from './actions/getNotionPageContent.js';

const pluginDefinition: PluginDefinition = {
  name: 'Notion',
  description: 'Notion plugin for Connery',
  actions: [getNotionPageContent],
};

const handler = await setupPluginServer(pluginDefinition);
export default handler;
