import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../queue/queue.module';
import { ResearchController } from './research.controller';
import { ResearchReport } from './research-report.entity';
import { ResearchService } from './research.service';

@Module({
  imports: [TypeOrmModule.forFeature([ResearchReport]), QueueModule],
  controllers: [ResearchController],
  providers: [ResearchService],
})
export class ResearchModule {}
