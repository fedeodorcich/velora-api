import { Type } from 'class-transformer';
import { Allow, IsObject, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

class WebhookResourceDto {
  @Type(() => String)
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,64}$/)
  id: string;
}

export class MercadoPagoWebhookDto {
  @IsString()
  @MaxLength(48)
  type: string;

  @IsObject()
  @ValidateNested()
  @Type(() => WebhookResourceDto)
  data: WebhookResourceDto;

  @Allow() id?: unknown;
  @Allow() action?: unknown;
  @Allow() api_version?: unknown;
  @Allow() date_created?: unknown;
  @Allow() live_mode?: unknown;
  @Allow() user_id?: unknown;
  @Allow() application_id?: unknown;
  @Allow() version?: unknown;
  @Allow() entity?: unknown;
}
