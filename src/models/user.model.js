import mongoose from "mongoose";
import { ALL_ROLES, ROLES } from "../constants/roles.js";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },
    username: { type: String, trim: true, unique: true, required: true, lowercase: true },
    phone: { type: String, trim: true, default: undefined },
    passwordHash: { type: String, select: false },
    password: { type: String, select: false },
    role: { type: String, enum: ALL_ROLES, default: ROLES.OWNER, required: true },
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },

    birthDate: { type: Date, default: null },
    gender: { type: String, enum: ["male", "female"], default: null },
    address: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
