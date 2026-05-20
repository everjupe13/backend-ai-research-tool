import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { ResearchReport, ReportStatus } from '../research/research-report.entity';
import { RESEARCH_JOB, RESEARCH_QUEUE } from './queue.constants';

export interface ResearchJobPayload {
  reportId: string;
  userId: string;
  topic: string;
}

@Processor(RESEARCH_QUEUE)
export class ResearchProcessor extends WorkerHost {
  private readonly logger = new Logger(ResearchProcessor.name);

  constructor(
    @InjectRepository(ResearchReport)
    private readonly reportsRepo: Repository<ResearchReport>,
    private readonly aiService: AiService,
  ) {
    super();
  }

  async process(job: Job<ResearchJobPayload>): Promise<void> {
    if (job.name !== RESEARCH_JOB) return;

    const { reportId, topic } = job.data;
    this.logger.log(`Processing report ${reportId} — topic: "${topic}"`);

    await this.reportsRepo.update(reportId, { status: ReportStatus.PROCESSING });

    try {
      const summary = await this.aiService.summarize(topic, []);

      await this.reportsRepo.update(reportId, {
        status: ReportStatus.DONE,
        summary,
        sources: [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Report ${reportId} failed: ${message}`);
      await this.reportsRepo.update(reportId, {
        status: ReportStatus.FAILED,
        errorMessage: message,
      });
    }
  }
}
