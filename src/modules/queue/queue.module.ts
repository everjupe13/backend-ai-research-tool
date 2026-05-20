import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResearchReport } from '../research/research-report.entity';
import { RESEARCH_QUEUE } from './queue.constants';
import { ResearchProcessor } from './research.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: RESEARCH_QUEUE }),
    TypeOrmModule.forFeature([ResearchReport]),
  ],
  providers: [ResearchProcessor],
  exports: [BullModule],
})
export class QueueModule {}
