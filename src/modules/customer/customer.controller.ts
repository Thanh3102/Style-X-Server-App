import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { QueryParams } from 'src/utils/types/query.types';
import { JwtGuard } from 'src/guards/jwt.guard';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { ChangePasswordDto, UpdateInfoDto } from './customer.type';
import { Public } from 'src/decorators/public.decorator';
import { Response } from 'express';
import { AuthenticatedRequest } from 'src/utils/types';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('/history')
  getOrderHistory(
    @Query() query: { status: string; page: string; limit: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<Response> {
    return this.customerService.getOrderHistory(query, req, res);
  }

  @Get('/')
  getCustomer(
    @Query() query: QueryParams,
    @Res() res: Response
  ): Promise<Response> {
    return this.customerService.get(query, res);
  }

  @Get('/info')
  getInfo(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<Response> {
    return this.customerService.getInfo(req, res);
  }

  @Put('/info')
  updateInfo(
    @Body() dto: UpdateInfoDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<Response> {
    return this.customerService.updateInfo(dto, req, res);
  }

  @Put('/changePassword')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<Response> {
    return this.customerService.changePassword(dto, req, res);
  }

  @Get('/:customerId')
  getCustomerDetail(
    @Param('customerId') customerId: string,
    @Query() query: QueryParams,
    @Res() res: Response
  ): Promise<Response> {
    return this.customerService.getDetail(customerId, query, res);
  }

  @Public()
  @Post('/forget-password')
  createForgetPasswordToken(
    @Body() dto: { email: string },
    @Res() res: Response
  ): Promise<Response> {
    return this.customerService.createForgetPasswordToken(dto.email, res);
  }

  @Public()
  @Post('/reset-password')
  resetPassword(
    @Body() dto: { token: string; newPassword: string },
    @Res() res: Response
  ): Promise<Response> {
    return this.customerService.resetPassword(dto.token, dto.newPassword, res);
  }
}
