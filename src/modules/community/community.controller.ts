import { AdvertisingService } from './advertising.service.js';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../core/interfaces/authenticated-user.interface.js';
import { CommunityService } from './community.service.js';
import { ContactRequestDto, DonationDto } from './community.dto.js';
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService,private readonly advertising:AdvertisingService) {}
 @Get('advertising') @Header('Cache-Control','no-store') @UseGuards(JwtAuthGuard)
 advertisingStatus(@CurrentUser() user:AuthenticatedUser){return this.advertising.status(user.id);}
  @Get('config') @Header('Cache-Control', 'no-store') config() {
    return this.community.config();
  }
  @Post('contact') @HttpCode(201) contact(@Body() dto: ContactRequestDto) {
    return this.community.contact(dto);
  }
  @Post('donations/test-checkout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  testDonation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DonationDto,
  ) {
    return this.community.testDonation(user.email, dto.amount);
  }
}
