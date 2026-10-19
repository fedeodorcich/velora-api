import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  create(data: CreateUserData): Promise<User> {
    const user = this.usersRepository.create({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      name: data.name.trim(),
    });
    return this.usersRepository.save(user);
  }
}
