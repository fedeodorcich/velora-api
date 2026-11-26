import { ContactMailService } from './contact-mail.service.js';
import { AdvertisingService } from './advertising.service.js';
import { User } from '../users/entities/user.entity.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactRequest } from './contact-request.entity.js';
import { CommunityController } from './community.controller.js';
import { CommunityService } from './community.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([ContactRequest, User])],
  controllers: [CommunityController],
  providers: [CommunityService, ContactMailService, AdvertisingService],
})
export class CommunityModule {}
