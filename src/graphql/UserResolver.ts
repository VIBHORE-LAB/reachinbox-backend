import { UserService } from "../services/userService";

export const userResolver = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      try {
        if (!context.user) throw new Error("Not authenticated");
        return context.user;
      } catch (err: any) {
        throw new Error(err.message);
      }
    },
  },

  Mutation: {
    registerUser: async (_: any, { email, password }: any) => {
      try {
        const user = await UserService.register(email, password);
        return user;
      } catch (err: any) {
        throw new Error(err.message);
      }
    },

    loginUser: async (_: any, { email, password }: any) => {
      try {
        const user = await UserService.login(email, password);
        return user;
      } catch (err: any) {
        throw new Error(err.message);
      }
    },
  },
};
