import { mergeResolvers } from "@graphql-tools/merge";
import { userResolver } from "./UserResolver";
import { accountResolvers } from "./AccountResolver";
import { emailResolvers } from "./EmailResolver";

export const resolvers = mergeResolvers([
    userResolver,
    accountResolvers,
    emailResolvers
]);