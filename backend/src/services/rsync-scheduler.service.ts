import cron from 'node-cron';
import { prisma } from '../db/prisma';
import { rsyncService } from './rsync.service';

class RsyncSchedulerService {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initializes all active scheduled rsync jobs from database on startup
   */
  async initScheduler(): Promise<void> {
    console.log('[RSYNC-SCHEDULER] Initializing scheduled rsync jobs from database...');
    this.stopAll();

    try {
      const activeJobs = await prisma.rsyncJob.findMany({
        where: {
          isActive: true,
          cronSchedule: { not: null },
        },
      });

      for (const job of activeJobs) {
        if (job.cronSchedule && cron.validate(job.cronSchedule)) {
          this.scheduleJob(job.id, job.cronSchedule, job.name);
        }
      }

      console.log(`[RSYNC-SCHEDULER] Successfully loaded ${this.scheduledTasks.size} active rsync schedules.`);
    } catch (err: any) {
      console.error('[RSYNC-SCHEDULER] Failed to initialize rsync schedules:', err.message);
    }
  }

  /**
   * Dynamically registers or updates a scheduled rsync task in memory
   */
  scheduleJob(jobId: string, cronSchedule: string, jobName: string): boolean {
    if (!cron.validate(cronSchedule)) {
      console.warn(`[RSYNC-SCHEDULER] Invalid cron expression for job "${jobName}": "${cronSchedule}"`);
      return false;
    }

    // Stop existing task if already scheduled
    this.unscheduleJob(jobId);

    const task = cron.schedule(cronSchedule, async () => {
      console.log(`[RSYNC-SCHEDULER] Triggering scheduled execution for job "${jobName}" (${jobId})...`);
      try {
        await rsyncService.executeJob(jobId, 'SCHEDULED', 'SYSTEM_SCHEDULER');
      } catch (err: any) {
        console.error(`[RSYNC-SCHEDULER] Error executing scheduled job "${jobName}":`, err.message);
      }
    });

    this.scheduledTasks.set(jobId, task);
    console.log(`[RSYNC-SCHEDULER] Scheduled job "${jobName}" with cron: "${cronSchedule}"`);
    return true;
  }

  /**
   * Removes a scheduled task from memory
   */
  unscheduleJob(jobId: string): void {
    const existing = this.scheduledTasks.get(jobId);
    if (existing) {
      existing.stop();
      this.scheduledTasks.delete(jobId);
      console.log(`[RSYNC-SCHEDULER] Unscheduled rsync job: ${jobId}`);
    }
  }

  /**
   * Stops all active rsync scheduled tasks
   */
  stopAll(): void {
    for (const [id, task] of this.scheduledTasks.entries()) {
      task.stop();
    }
    this.scheduledTasks.clear();
  }
}

export const rsyncSchedulerService = new RsyncSchedulerService();
