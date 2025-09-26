# Email Sync Backend

**Purpose**  

This repository implements the backend for an Email Sync assignment. It:

- Synchronizes IMAP accounts in real-time (IDLE)
- Indexes emails into Elasticsearch for search
- Runs zero-shot AI categorization
- Stores vectors for Retrieval-Augmented Generation (RAG) in Qdrant
- Notifies via Slack / external webhooks on "Interested" emails
- Exposes a GraphQL API (Apollo Server) for clients (frontend or Postman) to manage accounts and query/search emails
- Uses MongoDB to persist user and account records

---

**Frontend Repo**  
[Access the frontend repository here](#)

## Table of Contents

- [Project Overview](#project-overview)
- [Technologies & Reasons](#technologies--reasons)
- [Prerequisites](#prerequisites)
- [Configuration (`.env`)](#configuration-env)
- [Docker Compose (Services)](#docker-compose-services)
- [Initial Setup & Run](#initial-setup--run)
-

---

## Project Overview

High-level flow:

1. User registers or logs in.
2. User adds one or more IMAP accounts (or uses demo accounts).
3. `ImapService` keeps persistent IMAP connections (IDLE) and:
   - Fetches last 30 days of email history
   - Parses emails with `mailparser`
   - Indexes email documents into Elasticsearch
   - Embeds email body and upserts into Qdrant
   - Runs OpenAI zero-shot classification
   - Triggers Slack/webhook notifications when label is `Interested`
   - Allows generating AI-suggested replies which can be sent back to original senders
4. Clients interact with the backend via GraphQL (`/graphql`) to:
   - Read emails
   - Set labels
   - Request suggested replies (RAG)
   - Manage accounts

---

## Technologies & Reasons

| Technology | Reason |
|------------|--------|
| **Node.js + TypeScript** | Async IO for network-bound services; TypeScript adds static typing for maintainability |
| **Apollo Server (GraphQL)** | Flexible endpoint for queries/mutations; frontend can request only necessary fields |
| **imapflow** | Modern IMAP client with robust IDLE support and streaming capabilities |
| **mailparser** | Parses raw email sources into structured text, HTML, attachments, and headers |
| **nodemailer** | Emails the suggested reply back to the source |

| **Elasticsearch** | Full-text search, filtering, ranking, optimized for large datasets |
| **MongoDB + Mongoose** | Flexible document storage for users and IMAP accounts |
| **Qdrant (vector DB)** | Stores vector embeddings for RAG; simple HTTP API; fast nearest-neighbor search |
| **OpenAI API** | Zero-shot classification, embeddings, and text generation |
| **Docker & Docker Compose** | Reproducible environment for Elasticsearch, Qdrant, and MongoDB |
| **uuid** | Generate unique identifiers for emails/resources |
| **axios / node-fetch** | HTTP client libraries for webhooks/Slack integration |

---

## Prerequisites

- Node.js >= 18
- Docker & Docker Compose
- OpenAI API key
- Elasticsearch instance
- Qdrant instance
- MongoDB instance

---
## Docker Compose (Services)

- MongoDB
- Elasticsearch
- Qdrant

---

## Initial Setup & Run

```bash
# Install dependencies
npm install

# Start services
docker-compose up -d

# Run backend
npm run dev


