---
name: ntfy-after-task
description: Sends an ntfy notification after the agent finishes a task. Use this when ntfy MCP tools are available and the user wants completion notifications for each finished task.
---

Use this skill when the user wants an ntfy notification after the agent finishes work.

This skill assumes an ntfy MCP server is already configured and exposes `ntfy_ping` or `ntfy_publish`.

## When to Use This Skill

Activate this skill when the user:

- Asks to be notified after each completed task
- Mentions ntfy, push notifications, or background completion alerts
- Wants a completion ping when the agent finishes working

## Rules

Send exactly one ntfy notification after the task is complete.

- Send the notification after finishing the work and verification steps, but before the final response
- Do not send the notification before the work is actually done
- Do not send repeated notifications for the same completed task
- If the task is blocked or fails, send a notification that clearly says it was blocked or failed
- Skip the notification for purely conversational replies unless the user explicitly wants a notification for those too

## Tool Selection

1. Use `ntfy_ping` when available for a simple completion notification
2. Use `ntfy_publish` when you need a more specific title or message

## Notification Content

For successful completion, prefer:

- Title: `Agent finished`
- Message: a short summary of what completed
- Priority: `default`
- Tags: `robot_face`, `white_check_mark`

For blocked or failed work, prefer:

- Title: `Agent blocked` or `Agent failed`
- Message: short reason
- Priority: `high`
- Tags: `warning`, `robot_face`

## Workflow

### 1. Finish the task

Complete the requested work first, including validation when appropriate.

### 2. Send the ntfy notification

Use one of these patterns:

Simple completion with `ntfy_ping`:

```json
{
  "title": "Agent finished",
  "message": "Completed the requested task.",
  "priority": "default",
  "tags": ["robot_face", "white_check_mark"]
}
```

More specific completion:

```json
{
  "title": "Agent finished",
  "message": "Implemented the requested change and verified the result.",
  "priority": "default",
  "tags": ["robot_face", "white_check_mark"]
}
```

Blocked or failed task:

```json
{
  "title": "Agent blocked",
  "message": "Work stopped because authentication or a required dependency was unavailable.",
  "priority": "high",
  "tags": ["warning", "robot_face"]
}
```

### 3. Return the final response

After the notification is sent, give the user the normal final response summarizing the outcome.

## Notes

- Keep notification text short and useful
- Avoid including secrets, tokens, or sensitive file contents
- If the configured ntfy tool fails, mention that briefly in the final response
- Keep using the normal final response flow after sending the notification
