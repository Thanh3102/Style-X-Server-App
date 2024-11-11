import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtGuard } from 'src/guards/jwt.guard';
import { Public } from 'src/decorators/Public.decorator';
import { QueryParams } from 'src/utils/types';

@UseGuards(JwtGuard)
@Controller('employee')
export class EmployeesController {
  constructor(private employeeService: EmployeesService) {}

  @Get('/')
  getUsers(@Query() queryParams: QueryParams, @Res() res) {
    return this.employeeService.getUsers(res, queryParams);
  }
}
