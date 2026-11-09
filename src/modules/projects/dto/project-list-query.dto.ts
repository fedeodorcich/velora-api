import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../core/dto/pagination-query.dto.js';
import { ProjectStatus } from '../entities/project.entity.js';

export class ProjectListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
