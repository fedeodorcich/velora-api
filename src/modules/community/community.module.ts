import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactRequest } from './contact-request.entity.js';
import { CommunityController } from './community.controller.js';
import { CommunityService } from './community.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([ContactRequest])],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
