import { IsEnum } from 'class-validator';
import { ProjectStatus } from '../entities/project.entity.js';

export class UpdateProjectStatusDto {
  @IsEnum(ProjectStatus, { message: 'El estado del proyecto no es válido.' })
  status: ProjectStatus;
}
