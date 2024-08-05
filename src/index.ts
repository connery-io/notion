import { PluginDefinition, setupPluginServer } from 'connery';
import retrieveKnowledge from "./actions/retrieveKnowledge.js";

const pluginDefinition: PluginDefinition = {
  name: 'notion',
  description: 'Plugin enables to interact with notion content, especially working with and extending knowledge',
  actions: [retrieveKnowledge],
};

const handler = await setupPluginServer(pluginDefinition);
export default handler;
