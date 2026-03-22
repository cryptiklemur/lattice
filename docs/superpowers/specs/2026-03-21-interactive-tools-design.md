# Interactive Tool Support: AskUserQuestion, TodoWrite, Plan Mode

## Overview

Add first-class UI rendering for interactive tools that currently show as generic collapsed tool blocks. Three tools in scope:
- **AskUserQuestion** — presents questions with selectable options, routes answers back to the SDK
- **TodoWrite** — displays task lists with status tracking inline in chat
- **EnterPlanMode/ExitPlanMode** — shows plan mode state indicator

## Architecture: canUseTool Interception

All three tools are intercepted in the `canUseTool` handler in `sdk-bridge.ts` — the same pattern used for permission requests. The SDK's built-in `AskUserQuestion` tool has `checkPermissions` that returns `{ behavior: "ask" }`, which routes through the external `canUseTool` handler — this is the same flow that all permission requests follow. Lattice's `canUseTool` is the single interception point for all tool permission decisions.

When `canUseTool` is called with an interactive tool name:

1. Parse the tool's `input` args
2. Send a typed WebSocket message to the client
3. For AskUserQuestion: store a pending resolver, wait for the client's response, then resolve the promise with `{ behavior: "allow", updatedInput: { ...input, answers: userAnswers } }`
4. For TodoWrite and Plan Mode: auto-allow the tool immediately but send display data to the client

The `updatedInput` carries the user's answers back into the tool's `call()` method, which reads `answers` from the input and returns them as the tool result. This is how the SDK's own CLI handles it — `call({ questions, answers = {} })` reads `answers` from the (potentially updated) input.

**Integration point:** Add `toolConfig: { askUserQuestion: { previewFormat: "html" } }` to `queryOptions` so the SDK instructs Claude to emit HTML preview content instead of markdown, suitable for web rendering.

## AskUserQuestion

### How the SDK Flow Works

1. Claude calls `AskUserQuestion` with `{ questions: [...] }`
2. SDK's internal `checkPermissions` returns `{ behavior: "ask", updatedInput: input }`
3. This triggers the external `canUseTool` handler (Lattice's interception point)
4. Lattice sends the questions to the client UI and waits for the user's selection
5. User selects options → Lattice resolves with `{ behavior: "allow", updatedInput: { ...input, answers: { "question text": "selected label" }, annotations } }`
6. SDK calls the tool's `call()` with the updated input → `call({ questions, answers, annotations })`
7. `call()` returns `{ data: { questions, answers, annotations } }`
8. `mapToolResultToToolResultBlockParam` formats answers as text for Claude: `"User has answered your questions: "question"="answer""`

### SDK Tool Input Format

```typescript
{
  questions: Array<{
    question: string;
    header: string;       // short chip label (max 12 chars)
    options: Array<{
      label: string;       // 1-5 words
      description: string;
      preview?: string;    // HTML fragment (with toolConfig.askUserQuestion.previewFormat: "html")
    }>;
    multiSelect: boolean;
  }>;
  // These are added by the client via updatedInput:
  answers?: Record<string, string>;
  annotations?: Record<string, { notes?: string; preview?: string }>;
  metadata?: { source?: string };
}
```

Multi-select answers are comma-separated strings (e.g. `"Option A, Option B"`).

### Server-Side Interception

In `sdk-bridge.ts`, add a check at the top of `canUseTool` (before the permission flow):

```
if toolName === "AskUserQuestion":
  - Use options.toolUseID as the requestId
  - Send "chat:prompt_request" to client with { requestId, questions: input.questions }
  - Store a pending resolver in pendingPermissions Map (reuse existing infrastructure)
    with a discriminator field: { type: "prompt", ... }
  - Return a Promise that resolves when client responds
  - When client sends "chat:prompt_response" { requestId, answers }:
    - Resolve with { behavior: "allow", updatedInput: { ...input, answers }, toolUseID: options.toolUseID }
```

**Reusing `pendingPermissions`:** Rather than creating a parallel Map, store prompt requests in the same `pendingPermissions` Map with a `type: "prompt"` discriminator. This gives free cleanup on session end (existing cleanup at lines 572-580 iterates `pendingPermissions` and resolves all pending entries).

### Client-Side Rendering

A new `PromptQuestion` component renders inline in the chat message stream as a special `HistoryMessage` with `type: "prompt_question"`.

**Active state (waiting for answer):**
- Card with question text as heading and header as a chip/tag
- Option buttons — each shows label + description
- Single-select: clicking one submits immediately
- Multi-select: checkboxes with a "Submit" button
- "Other" text input at the bottom for free-text answers
- Subtle primary-colored border to indicate waiting for input

**Resolved state (after answering):**
- Collapses to a compact line: `"✓ [header]: [selected option]"`
- Expandable to see the full question and all options

### WebSocket Messages

```typescript
// Server → Client (add to ServerMessage union)
interface ChatPromptRequestMessage {
  type: "chat:prompt_request";
  requestId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string; preview?: string }>;
    multiSelect: boolean;
  }>;
}

// Client → Server (add to ClientMessage union)
interface ChatPromptResponseMessage {
  type: "chat:prompt_response";
  requestId: string;
  answers: Record<string, string>;
  annotations?: Record<string, { notes?: string; preview?: string }>;
}
```

### HistoryMessage Extension

Add optional fields to `HistoryMessage` in `shared/src/models.ts`:

```typescript
// Existing fields...
promptQuestions?: Array<{
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
}>;
promptAnswers?: Record<string, string>;
promptStatus?: "pending" | "answered" | "timed_out";
todos?: Array<{
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}>;
```

### Store Integration

When `chat:prompt_request` arrives:
1. Add a `HistoryMessage` with `type: "prompt_question"`, `toolId: requestId`, `promptQuestions: questions`, `promptStatus: "pending"`
2. The `PromptQuestion` component renders based on this message

When user answers:
1. Send `chat:prompt_response` via WebSocket
2. Update the `HistoryMessage` in the store: set `promptAnswers` and `promptStatus: "answered"`
3. The component re-renders in resolved state

### Handling in chat.ts

The `chat:prompt_response` message is handled in `server/src/handlers/chat.ts` inside the existing `registerHandler("chat", ...)` function. Add a new `if` branch:

```
if (message.type === "chat:prompt_response") {
  var promptMsg = message as ChatPromptResponseMessage;
  var pending = getPendingPermission(promptMsg.requestId);
  if (pending && pending.type === "prompt") {
    pending.resolve({
      behavior: "allow",
      updatedInput: { ...pending.input, answers: promptMsg.answers, annotations: promptMsg.annotations },
      toolUseID: pending.toolUseID,
    });
    deletePendingPermission(promptMsg.requestId);
    sendTo(clientId, { type: "chat:prompt_resolved", requestId: promptMsg.requestId });
  }
  return;
}
```

## TodoWrite

### SDK Tool Input Format

```typescript
{
  todos: Array<{
    id: string;
    content: string;
    status: "pending" | "in_progress" | "completed";
    priority: "high" | "medium" | "low";
  }>;
}
```

### Server-Side Handling

In `canUseTool`, before the permission flow:
```
if toolName === "TodoWrite":
  - Parse the todos from input
  - Send "chat:todo_update" to client with { todos: input.todos }
  - Return { behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } immediately
```

No user interaction needed — TodoWrite is display-only.

### Client-Side Rendering

A `TodoCard` component renders inline in chat as a `HistoryMessage` with `type: "todo_update"`:

- Task list with status indicators:
  - Pending: empty circle outline
  - In progress: filled dot with pulse
  - Completed: checkmark
- Task title text
- Compact layout with monospace status labels

Each `chat:todo_update` creates or replaces the TodoCard in the message stream. There is only one active TodoCard per session — new updates replace the previous one. The previous card collapses to show "Tasks updated" with the count.

### WebSocket Message

```typescript
// Server → Client (add to ServerMessage union)
interface ChatTodoUpdateMessage {
  type: "chat:todo_update";
  todos: Array<{
    id: string;
    content: string;
    status: "pending" | "in_progress" | "completed";
    priority: "high" | "medium" | "low";
  }>;
}
```

## Plan Mode

### Server-Side Handling

In `canUseTool`, before the permission flow:
```
if toolName === "EnterPlanMode":
  - Send "chat:plan_mode" to client with { active: true }
  - Return { behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } immediately

if toolName === "ExitPlanMode":
  - Send "chat:plan_mode" to client with { active: false }
  - Return { behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } immediately
```

### Client-Side Rendering

- When plan mode is active, show a compact banner below the chat header: "Plan Mode" with a primary accent color badge
- Plan content renders as normal assistant messages in the chat
- When plan mode exits, the banner disappears

### WebSocket Message

```typescript
// Server → Client (add to ServerMessage union)
interface ChatPlanModeMessage {
  type: "chat:plan_mode";
  active: boolean;
}
```

### Store Integration

Add `isPlanMode: boolean` to the session store. Reset to `false` on session switch (in the `handleHistory` handler in `useSession.ts`).

## New Files

| File | Purpose |
|------|---------|
| `client/src/components/chat/PromptQuestion.tsx` | Interactive question card with option buttons |
| `client/src/components/chat/TodoCard.tsx` | Task list display card |

## Modified Files

| File | Changes |
|------|---------|
| `shared/src/messages.ts` | Add ChatPromptRequestMessage, ChatTodoUpdateMessage, ChatPlanModeMessage to ServerMessage union. Add ChatPromptResponseMessage to ClientMessage union. |
| `shared/src/models.ts` | Add `promptQuestions`, `promptAnswers`, `promptStatus`, `todos` optional fields to HistoryMessage |
| `server/src/project/sdk-bridge.ts` | Add `toolConfig` to queryOptions. Intercept AskUserQuestion/TodoWrite/EnterPlanMode/ExitPlanMode in canUseTool before the permission flow. Add `type` discriminator to pending entries. |
| `server/src/handlers/chat.ts` | Add `chat:prompt_response` handler branch. Import ChatPromptResponseMessage. |
| `client/src/hooks/useSession.ts` | Subscribe to `chat:prompt_request`, `chat:todo_update`, `chat:plan_mode`. Add `isPlanMode` to state. |
| `client/src/stores/session.ts` | Add `isPlanMode: boolean` to SessionState. Add setter. |
| `client/src/components/chat/Message.tsx` | Render PromptQuestion for `type === "prompt_question"` and TodoCard for `type === "todo_update"` |
| `client/src/components/chat/ChatView.tsx` | Show plan mode banner when `isPlanMode` is true |

## Error Handling

- **Prompt timeout**: If the user doesn't answer within 5 minutes, auto-resolve with empty answers `{}` and update the message to show "timed out" state
- **Disconnect during prompt**: The existing `pendingPermissions` cleanup at session end resolves all pending entries (since prompts are stored in the same Map). The SDK gets a deny/empty response.
- **Multiple prompts**: Prompts queue naturally — the SDK calls `canUseTool` sequentially per tool invocation, so each prompt waits for resolution before the next one is triggered. No explicit client-side queue needed.

## Accessibility

- Prompt options are keyboard navigable (arrow keys to move, Enter/Space to select)
- `role="radiogroup"` for single-select, `role="group"` with checkboxes for multi-select
- `aria-live="polite"` on the prompt card when it first appears
- Focus automatically moves to the first option when a prompt appears
- Todo items use `role="list"` with `role="listitem"`
- Plan mode banner has `role="status"` with `aria-live="polite"`
