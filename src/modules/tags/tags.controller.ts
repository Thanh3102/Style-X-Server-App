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

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('tags')
export class TagsController {
  constructor(private tagService: TagsService) {}

  @Get('/')
  getTag(@Query() queryParams: QueryParams, @Res() res) {
    return this.tagService.getTags(res, queryParams);
  }

}
