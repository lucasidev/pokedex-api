import bcrypt from 'bcrypt';
import { type HydratedDocument, type Model, model, Schema, type Types } from 'mongoose';

const BCRYPT_ROUNDS = 12;

interface PokeTeam {
  name: string;
  pokemon: string[];
}

export interface UserAttributes {
  name: string;
  username: string;
  email: string;
  password: string;
  pokedex: string[];
  poketeam: PokeTeam | null;
  roles: Types.ObjectId[];
}

interface UserMethods {
  comparePassword(plain: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<UserAttributes, UserMethods>;
export type UserModel = Model<UserAttributes, Record<string, never>, UserMethods>;

const userSchema = new Schema<UserAttributes, UserModel, UserMethods>(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    pokedex: { type: [String], default: [] },
    poketeam: {
      type: new Schema<PokeTeam>(
        {
          name: { type: String, required: true },
          pokemon: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: null,
    },
    roles: { type: [Schema.Types.ObjectId], ref: 'Role', default: [] },
  },
  { timestamps: true, versionKey: false },
);

userSchema.methods.comparePassword = async function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  next();
});

export const User = model<UserAttributes, UserModel>('User', userSchema);
