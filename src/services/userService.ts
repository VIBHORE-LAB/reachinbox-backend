import UserModel from "../models/user.model";

export const UserService = {
  register: async (email: string, password: string) => {
    try {
      const existing = await UserModel.findOne({ email });
      if (existing) throw new Error("User already exists");

      const user = await UserModel.create({ email, password });
      return { id: user._id.toString(), email: user.email };
    } catch (err: any) {
      throw new Error(err.message);
    }
  },

  login: async (email: string, password: string) => {
    try {
      const user = await UserModel.findOne({ email });
      if (!user) throw new Error("User not found");

      const match = await user.comparePassword(password); 
      if (!match) throw new Error("Invalid Credentials");

      return { id: user._id.toString(), email: user.email };
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
};
