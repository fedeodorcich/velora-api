import { IsString, MaxLength, MinLength } from 'class-validator';
export class GoogleLoginDto {
  @IsString() @MinLength(20) @MaxLength(10000) credential: string;
  @IsString() @MinLength(32) @MaxLength(128) nonce: string;
}
