---
description: This workflow analyzes the immediate conversation history to extract completed tasks and automatically prepends them to the root `CHANGELOG.md` file.
---

## 🛑 TRIGGER CONDITION (STRICT)

**DO NOT run this workflow autonomously.** You are strictly forbidden from executing this workflow unless the user explicitly invokes it using a slash command (e.g., `/update-changelog.md`) or directly commands you to run it (e.g., `/update-changelog.md go`). If the user's current prompt does not explicitly contain this invocation, exit this workflow immediately and do nothing.

## Step 1: Analyze the Session

Review the current conversation context. Identify all successfully completed tasks, architectural decisions, and bug fixes that occurred during this specific coding session. Ignore aborted attempts or general brainstorming.

## Step 2: Format the Entry

Format the extracted accomplishments into a clean, professional markdown block.

- Use the current date and exact system time as the sub-heading in 24-hour format (e.g., `## [YYYY-MM-DD @ HH:MM]`)
- Group the bullet points logically under bolded categories like **🚀 Features**, **🛠 Architecture**, or **🐛 Hotfixes**.
- Keep bullet points concise and technical.

## Step 3: Inject the Update

Locate the `CHANGELOG.md` file in the root directory.

- Prepend the new formatted entry to the top of the document, immediately below the main `#` header, so the newest updates are always at the top.
- Do not modify previous entries into this changelog, only add a new entry with what was done/accomplished in the current conversation.

## Step 4: Mission Report

Write a brief confirmation message in the chat stating that the ledger has been updated successfully. Do NOT modify, touch, or propose changes to any `.ts`, `.tsx`, or `.css` files during this workflow.
