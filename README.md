# Notion

Connery plugin for retrieving content from Notion pages.

The Plugin currently contains only one action: `Get Notion Page Content`.

- Allows you to chat with the content of a Notion page. Can be used for FAQ, Knowledge Base, etc.
- The action extracts all content elements including text, media, and toggles, and returns the page content as a single string. It does not extract content form inline DBs.
- Allows you to provide additional instructions for the Connery assistant on how to handle the content.
  - This can be useful if the table contains additional information that should not be used for answering the question.
  - It can also be used to provide more context or output formatting instructions.

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
