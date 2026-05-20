import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { RESEARCH_JOB, RESEARCH_QUEUE } from '../queue/queue.constants';
import { ResearchJobPayload } from '../queue/research.processor';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ResearchReport, ReportStatus } from './research-report.entity';

@Injectable()
export class ResearchService {
  constructor(
    @InjectRepository(ResearchReport)
    private readonly reportsRepo: Repository<ResearchReport>,
    @InjectQueue(RESEARCH_QUEUE)
    private readonly researchQueue: Queue<ResearchJobPayload>,
  ) {}

  async create(userId: string, dto: CreateReportDto): Promise<ResearchReport> {
    const report = await this.reportsRepo.save(
      this.reportsRepo.create({ userId, topic: dto.topic }),
    );

    await this.researchQueue.add(
      RESEARCH_JOB,
      { reportId: report.id, userId, topic: dto.topic },
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
    );

    return report;
  }

  async findAll(
    userId: string,
    query: ReportQueryDto,
  ): Promise<{ items: ResearchReport[]; nextCursor: string | null }> {
    const limit = query.limit ?? 20;

    const qb = this.reportsRepo
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId })
      .orderBy('r.created_at', 'DESC')
      .limit(limit + 1);

    if (query.cursor) {
      qb.andWhere(
        'r.created_at < (SELECT created_at FROM research_reports WHERE id = :cursor)',
        {
          cursor: query.cursor,
        },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  async findOne(userId: string, id: string): Promise<ResearchReport> {
    const report = await this.reportsRepo.findOne({ where: { id, userId } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async remove(userId: string, id: string): Promise<void> {
    const report = await this.findOne(userId, id);

    if (report.status === ReportStatus.PROCESSING) {
      const job = await this.researchQueue.getJob(id);
      await job?.remove();
    }

    await this.reportsRepo.delete(id);
  }
}
