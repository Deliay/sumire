import mongoose, { Schema, model, type Model } from "mongoose";
import type { Role } from "../rbac/roles";
import { ROLES } from "../rbac/roles";

export interface UserDoc {
  _id: { toString(): string };
  username: string;
  passwordHash: string;
  role: Role;
  mustChangePassword: boolean;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    mustChangePassword: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

export const UserModel: Model<UserDoc> = model<UserDoc>("User", userSchema);

export async function connectMongo(url: string): Promise<void> {
  await mongoose.connect(url);
}

export async function findUserByUsername(username: string): Promise<UserDoc | null> {
  return UserModel.findOne({ username }).lean();
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  role: Role;
}): Promise<UserDoc> {
  const user = new UserModel({
    username: input.username,
    passwordHash: input.passwordHash,
    role: input.role,
    mustChangePassword: true,
  });
  await user.save();
  return user.toObject();
}

export async function updateUserPassword(
  username: string,
  passwordHash: string,
): Promise<void> {
  await UserModel.updateOne(
    { username },
    { $set: { passwordHash, mustChangePassword: false } },
  );
}

export async function listUsers(): Promise<{ username: string; role: Role; createdAt: Date }[]> {
  return UserModel.find({}, { username: 1, role: 1, createdAt: 1, _id: 0 }).lean();
}

export async function countSuperadmins(): Promise<number> {
  return UserModel.countDocuments({ role: "superadmin" });
}

export async function seedSuperadmin(
  username: string,
  passwordHash: string,
): Promise<boolean> {
  if (!username || !passwordHash) return false;
  const existing = await findUserByUsername(username);
  if (existing) return false; // 幂等：已存在不覆盖
  await UserModel.create({
    username,
    passwordHash,
    role: "superadmin",
    mustChangePassword: true,
  });
  return true;
}
