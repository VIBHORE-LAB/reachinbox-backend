\# Email Sync Backend

\*\*Purpose\*\*

This repository implements the backend for an Email Sync assignment: it synchronizes IMAP accounts in real time (IDLE), indexes emails into Elasticsearch for search, runs zero-shot AI categorization, stores vectors for Retrieval-Augmented Generation (RAG) in Qdrant, notifies via Slack / external webhooks on "Interested" emails, and exposes a GraphQL API (Apollo Server) for clients (frontend or Postman) to manage accounts and query/search emails. MongoDB is used to persist user and account records.

\---

\*\*Frontend Repo\*\*
**Frontend Repository**: Access the frontend repository [here](https://github.com/VIBHORE-LAB/reach-Inbox-Frontend).

\## Table of contents

\- Project overview

\- Technologies & reasons

\- Prerequisites

\- Repository layout

\- Configuration (\`.env\`)

\- Docker Compose (services)

\- Initial setup & run

\- Preload Qdrant training/outreach data

\- GraphQL endpoint & example queries/mutations

\- Security notes

\- Production recommendations & scaling

\- Troubleshooting

\- Tests & validation

\- Useful npm scripts

\- Where to go next

\- License

\---

\## Project overview

High-level flow:

1\. A user registers / logs in.

2\. User adds one or more IMAP accounts (or uses demo accounts).

3\. \`ImapService\` keeps persistent IMAP connections (IDLE) and:

\- fetches last 30 days history,

\- parses with \`mailparser\`,

\- indexes email documents into Elasticsearch,

\- embeds email body and upserts into Qdrant,

\- runs an OpenAI zero-shot classification,

\- triggers Slack/webhook when label is \`Interested\`.

\- The user can choose to generate a AI suggested reply and then mail back that to the original sender

4\. Client talks to the backend via the GraphQL endpoint (\`/graphql\`) to read emails, set labels, request suggested replies (RAG), and manage accounts.

\---

\## Technologies & why they were used

Every technology included and the reason:

\- \*\*Node.js + TypeScript\*\*

\- Reason: performant async IO for network-bound services (IMAP, HTTP). TypeScript adds static typing which improves maintainability and reduces subtle runtime bugs.

\- \*\*Apollo Server (GraphQL)\*\*

\- Reason: single, flexible endpoint for queries and mutations. Frontend can request exactly the fields needed and the API grows more cleanly than many REST endpoints.

\- \*\*imapflow\*\*

\- Reason: modern IMAP client with robust support for IDLE (persistent connections). It is reliable for long-lived IMAP sessions and provides streaming capabilities.

\- \*\*mailparser\*\*

\- Reason: robust parsing of raw email sources into structured text, HTML, attachments, headers.

\- \*\*Elasticsearch\*\*

\- Reason: specialized search engine optimised for full-text search, filtering, ranking, and large datasets. Ideal as the canonical store for email documents that need fast, expressive search.

\- \*\*MongoDB + Mongoose\*\*

\- Reason: flexible document storage for user accounts and IMAP account credentials (owner relationships). Simple to model user/account entities and durable across restarts.

\- \*\*Qdrant (vector DB)\*\*

\- Reason: stores vector embeddings for RAG. Qdrant has a simple HTTP API and good performance for nearest-neighbor search for text embeddings.

\- \*\*OpenAI (hosted API)\*\*

\- Reason: zero-shot classification, embeddings, and text generation without the need to train models locally. Fast to integrate and high-quality language capabilities.

\- \*\*bcrypt\*\*

\- Reason: secure password hashing for user accounts.

\- \*\*Docker & Docker Compose\*\*

\- Reason: reproducible local environment for Elasticsearch, Qdrant, and MongoDB.

\- \*\*uuid\*\*

\- Reason: generate unique identifiers for emails or other resources.

\- \*\*axios / node-fetch\*\*

\- Reason: HTTP client libraries for webhook/Slack integration and other HTTP side effects.

\---

