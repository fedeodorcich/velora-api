import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from '../quotes/entities/quote.entity.js';
import { Project } from './entities/project.entity.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Quote])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
