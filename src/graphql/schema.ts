import { gql } from "graphql-tag";

export const typeDefs = gql`
  type User {
    id: ID!
    email: String!
  }

  type Account {
    id: ID!
    host: String!
    port: Int!
    user: String!
    demo: Boolean
    createdAt: String
  }

  type Email {
    id: ID
    ownerId: ID
    account: String
    folder: String
    from: String
    to: [String!]
    subject: String
    date: String
    body: String
    snippet: String
    labels: [String!]
    suggestedReply: String
    fetchedAt: String
    flags: [String!]
    processed: Boolean
  }
type ReprocessResult {
  success: Boolean!
  processedCount: Int
}


  type Query {
    me: User
    listAccounts: [Account!]!
    emails(account: String, folder: String, q: String): [Email!]!
    fetchEmails(size: Int): [Email!]!
  }

  type Mutation {
    registerUser(email: String!, password: String!): User!
    loginUser(email: String!, password: String!): User!

    addAccount(host: String!, port: Int!, user: String!, password: String!): Account
    startImap(demo: Boolean!, input: AccountInput): [Account!]!
    setLabel(emailId: ID!, label: String!): Email
    suggestReply(emailText: String!): String
      reprocessUnprocessedEmails(ownerId: ID): ReprocessResult!

  }

  input AccountInput {
    host: String!
    port: Int!
    user: String!
    password: String!
  }
`;
