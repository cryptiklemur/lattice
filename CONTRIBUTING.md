# Contributing to Lattice

Thanks for your interest in contributing to Lattice! This document covers the basics you need to get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- Node.js 20+ (for some tooling)
- Git

### Getting Started

```bash
git clone https://github.com/cryptiklemur/lattice.git
cd lattice
bun install
bun run dev
```

The dev server starts on `http://localhost:7654` with hot reload for both server and client.

### Project Structure

```
lattice/
  shared/    # Shared TypeScript types and message definitions
  server/    # Bun server — WebSocket handlers, session management, mesh networking
  client/    # React + Vite client — dashboard, settings, chat UI
```

## Development Workflow

### Coding Standards

- Use `var` instead of `const`/`let`
- No arrow functions — use `function` keyword
- Use `lucide-react` for all icons
- Follow `.editorconfig` (2-space indent, LF line endings, UTF-8)
- One class per file

### Commit Messages

We follow [Angular Commit Message Conventions](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#-commit-message-format):

```
<type>(<scope>): <short summary>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `ci`

**Scopes:** `client`, `server`, `shared`, or omit for cross-cutting changes

**Examples:**
```
feat(client): add skill marketplace search
fix(server): use correct node identity for project list
refactor(shared): extract MCP form components
```

### Building

```bash
bun run build        # Build all packages
bun run typecheck    # Type-check without emitting
```

### Testing Changes

1. Run the dev server: `bun run dev`
2. Open `http://localhost:7654` in your browser
3. Verify your changes work visually

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes following the coding standards above
3. Ensure the project builds without errors: `bun run build`
4. Write a clear PR description explaining what changed and why
5. Submit your PR

## Reporting Issues

Use [GitHub Issues](https://github.com/cryptiklemur/lattice/issues) to report bugs or suggest features. Include:

- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your environment (OS, Bun version, browser)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
