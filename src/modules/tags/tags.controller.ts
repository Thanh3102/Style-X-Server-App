import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtGuard } from 'src/guards/jwt.guard';
import { TagsService } from './tags.service';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { QueryParams } from 'src/utils/types';
import { Response } from 'express';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagService: TagsService) {}

  @Get('/')
  getTag(
    @Query() queryParams: QueryParams,
    @Res() res: Response
  ): Promise<Response> {
    return this.tagService.getTags(res, queryParams);
  }
}
