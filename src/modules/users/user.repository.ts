import { UserModel, IUser, UserRole } from './user.model';

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  password?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  refreshToken?: string | null;
}

export class UserRepository {
  async create(data: CreateUserInput): Promise<IUser> {
    return UserModel.create(data);
  }

  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  async findByEmail(email: string, includePassword = false): Promise<IUser | null> {
    const query = UserModel.findOne({ email: email.toLowerCase() });
    if (includePassword) {
      query.select('+password');
    }
    return query.exec();
  }

  async findByIdWithRefreshToken(id: string): Promise<IUser | null> {
    return UserModel.findById(id).select('+refreshToken').exec();
  }

  async updateById(id: string, updateData: UpdateUserInput): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }).exec();
  }

  async count(): Promise<number> {
    return UserModel.countDocuments().exec();
  }
}

export const userRepository = new UserRepository();
