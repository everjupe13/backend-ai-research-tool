import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ResearchService } from './research.service';

@Controller('reports')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Post()
  @Throttle({ ai: { ttl: 60_000, limit: 1 } })
  create(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.researchService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User, @Query() query: ReportQueryDto) {
    return this.researchService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.researchService.findOne(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.researchService.remove(user.id, id);
  }
}
