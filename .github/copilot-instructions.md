# Project Context: Dopis (Smart Email Client)

This project aims to build a modern, local-first, privacy-safe intelligent email client.

## Core Vision

The primary goal of this project is to integrate local AI capabilities using an **Ollama** endpoint to create a smart email experience without compromising user privacy. Sensitive email data should _never_ be sent to external cloud APIs like OpenAI or Anthropic. All AI processing must remain secure, offline, and local to the user's machine.

## Key Planned AI Features (via Ollama)

- **Smart Sorting & Routing:** Automatically analyze incoming email content and sort/route them into appropriate folders (e.g., Newsletters, Urgent, Junk) using a local LLM.
- **Intelligent Auto-Tagging:** Generate contextual tags for emails based on their content, sender, and intent without sending data outside the local network.
- **Summarization:** Provide quick, locally-generated summaries of long email threads.

## Tech Stack

- **Framework:** Astro (Server-Side Rendering)
- **UI Library:** React (for interactive client-side components)
- **Styling:** Tailwind CSS (v4) & Shadcn UI components
- **State Management:** Nanostores (sharing state across Astro/React)
- **Email Protocol:** IMAP via `imapflow`
- **AI Integration (Planned):** Local Ollama REST API

## Agent Instructions

When proposing code, answering architectural questions, or contributing to this codebase, always adhere strictly to the following principles:

1. **Privacy First:** Never suggest integrating third-party cloud AI APIs for processing email bodies. Always plan for the local Ollama connection. Data stays with the user.
2. **Performance Optimization:** Email parsing and AI inference can be heavy and slow. Prioritize asynchronous fetching, skeleton loaders, and pagination. Keep the Astro server-side HTML rendering fast.
3. **Component Structure:** Rely on the existing design language. Use Shadcn UI MCP (`src/components/ui/`) and Lucide React (`lucide-react`) for consistent, accessible UI components. Use `client:load` for mounting interactive React components inside Astro pages.
4. **Data Handling:** Use `resolveFolder` in `src/utils/imapFolders.js` for resolving IMAP special-use attributes rather than hardcoding names. Extract sequence metadata (`client.mailbox.exists`) where possible to prevent retrieving bloated message bodies unnecessarily.
5. **API & Backend Design:** Endpoints should be designed as stateless, standalone REST/JSON APIs, so they can potentially be reused by other clients like a future mobile application.