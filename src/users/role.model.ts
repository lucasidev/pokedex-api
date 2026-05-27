import { type InferSchemaType, Schema, model } from 'mongoose';

export const ROLES = ['user', 'admin'] as const;
export type RoleName = (typeof ROLES)[number];

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
  },
  { versionKey: false },
);

export type Role = InferSchemaType<typeof roleSchema>;
export const RoleModel = model('Role', roleSchema);
