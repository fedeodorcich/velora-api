import { IsString, Matches, MaxLength } from 'class-validator';

export const MAX_QUOTE_LOGO_BYTES = 64 * 1024;

export class UpdateQuoteLogoDto {
  @IsString({ message: 'El logo debe ser una imagen PNG o JPEG.' })
  @MaxLength(22 + 4 * Math.ceil(MAX_QUOTE_LOGO_BYTES / 3), {
    message: 'El logo no puede superar los 64 KiB.',
  })
  @Matches(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/, {
    message: 'El logo debe ser una imagen PNG o JPEG.',
  })
  dataUrl: string;
}
