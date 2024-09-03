# Notion

This plugin enables interaction with Notion-based knowledge repositories, allowing users to query and retrieve answers from both public and private Notion pages. The plugin integrates with OpenAI to provide high-certainty answers based on the content available in Notion and suggests follow-ups in case of missing content.

Using the Connery platform, requests get securely logged, allowing for later analysis to identify gaps and opportunities to improve both the knowledge base and the action setup itself.
This ensures that your knowledge management processes can be continuously refined over time.

## Repository structure

This repository contains the plugin's source code.

| Path                            | Description                                                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [./src/index.ts](/src/index.ts) | **The entry point for the plugin.** It contains the plugin definition and references to all the actions.                                             |
| [./src/actions/](/src/actions/) | **This folder contains all the actions of the plugin.** Each action is represented by a separate file with the action definition and implementation. |

## Built using Connery SDK

This plugin is built using [Connery SDK](https://github.com/connery-io/connery), the open-source SDK for creating AI plugins and actions.

[Learn how to use the plugin and its actions.](https://sdk.connery.io/docs/quickstart/use-plugin)

## Support

If you have any questions or need help with this plugin, please create an issue in this repository.
