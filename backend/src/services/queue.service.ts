import { Types } from 'mongoose';
import { DepthPreset } from './stockfish.service';
import { getAnalysisService } from './analysis.service';

/**
 * Job status types
 */
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Analysis job interface
 */
export interface AnalysisJob {
  gameId: Types.ObjectId;
  depth: DepthPreset;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  resultId?: Types.ObjectId; // Reference to Analysis document
}

/**
 * Analysis Queue Service
 * Manages background processing of game analysis jobs
 */
export class AnalysisQueue {
  private queue: Map<string, AnalysisJob> = new Map();
  private isProcessing: boolean = false;

  /**
   * Add a game to the analysis queue
   */
  addJob(gameId: Types.ObjectId, depth: DepthPreset = 'fast'): AnalysisJob {
    const gameIdStr = gameId.toString();

    // Check if job already exists
    const existingJob = this.queue.get(gameIdStr);
    if (existingJob) {
      console.log(`⚠️ Job already exists for game ${gameIdStr}: ${existingJob.status}`);
      return existingJob;
    }

    // Create new job
    const job: AnalysisJob = {
      gameId,
      depth,
      status: 'queued',
      createdAt: new Date(),
    };

    this.queue.set(gameIdStr, job);
    console.log(`📥 Added job to queue: ${gameIdStr} (depth: ${depth})`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return job;
  }

  /**
   * Get job status
   */
  getJobStatus(gameId: Types.ObjectId): AnalysisJob | undefined {
    return this.queue.get(gameId.toString());
  }

  /**
   * Get all jobs
   */
  getAllJobs(): AnalysisJob[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    const jobs = Array.from(this.queue.values());

    return {
      total: jobs.length,
      queued: jobs.filter(j => j.status === 'queued').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
  }

  /**
   * Background worker - processes jobs sequentially
   */
  private async processQueue() {
    if (this.isProcessing) {
      return; // Already processing
    }

    this.isProcessing = true;
    console.log('🔄 Starting queue processor...');

    while (true) {
      // Find next queued job
      const queuedJobs = Array.from(this.queue.values())
        .filter(j => j.status === 'queued')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      if (queuedJobs.length === 0) {
        console.log('✅ Queue empty, stopping processor');
        this.isProcessing = false;
        break;
      }

      const job = queuedJobs[0];
      const gameIdStr = job.gameId.toString();

      console.log(`⚙️ Processing job: ${gameIdStr} (depth: ${job.depth})`);

      // Update job status
      job.status = 'processing';
      job.startedAt = new Date();
      this.queue.set(gameIdStr, job);

      try {
        // Run the analysis
        const analysisService = getAnalysisService();
        const result = await analysisService.analyzeGame(job.gameId, job.depth);

        // Mark as completed
        job.status = 'completed';
        job.completedAt = new Date();
        job.resultId = result._id;

        console.log(`✅ Job completed: ${gameIdStr}`);
      } catch (error) {
        // Mark as failed
        job.status = 'failed';
        job.completedAt = new Date();
        job.error = error instanceof Error ? error.message : 'Unknown error';

        console.error(`❌ Job failed: ${gameIdStr}`, error);
      }

      this.queue.set(gameIdStr, job);
    }
  }

  /**
   * Remove a job from the queue
   */
  removeJob(gameId: Types.ObjectId): boolean {
    const gameIdStr = gameId.toString();
    const job = this.queue.get(gameIdStr);

    // Don't remove if currently processing
    if (job?.status === 'processing') {
      console.warn(`⚠️ Cannot remove job ${gameIdStr}: currently processing`);
      return false;
    }

    const deleted = this.queue.delete(gameIdStr);
    if (deleted) {
      console.log(`🗑️ Removed job: ${gameIdStr}`);
    }

    return deleted;
  }

  /**
   * Clear completed and failed jobs
   */
  clearFinishedJobs(): number {
    const toRemove = Array.from(this.queue.entries())
      .filter(([_, job]) => job.status === 'completed' || job.status === 'failed')
      .map(([key, _]) => key);

    toRemove.forEach(key => this.queue.delete(key));

    console.log(`🗑️ Cleared ${toRemove.length} finished jobs`);
    return toRemove.length;
  }

  /**
   * Clear all jobs (use with caution)
   */
  clearAllJobs(): void {
    const hadProcessing = Array.from(this.queue.values()).some(j => j.status === 'processing');

    if (hadProcessing) {
      console.warn('⚠️ Clearing queue while jobs are processing!');
    }

    this.queue.clear();
    this.isProcessing = false;
    console.log('🗑️ Cleared all jobs from queue');
  }

  /**
   * Get estimated time for a job (very rough estimate)
   */
  getEstimatedTime(gameId: Types.ObjectId): number | null {
    const job = this.queue.get(gameId.toString());
    if (!job) return null;

    if (job.status === 'completed' || job.status === 'failed') {
      return 0; // Already done
    }

    if (job.status === 'processing') {
      return 60; // Assume ~1 minute remaining for current job
    }

    // For queued jobs, estimate based on position in queue
    const queuedJobs = Array.from(this.queue.values())
      .filter(j => j.status === 'queued')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const position = queuedJobs.findIndex(j => j.gameId.toString() === gameId.toString());

    if (position === -1) return null;

    // Rough estimates based on depth
    const timePerJob = {
      fast: 60,      // ~1 minute
      balanced: 300, // ~5 minutes
      thorough: 600, // ~10 minutes
    };

    const estimatedTime = timePerJob[job.depth] || 120;
    const processingTime = this.isProcessing ? timePerJob[queuedJobs[0]?.depth || 'fast'] : 0;

    return processingTime + (position * estimatedTime);
  }
}

/**
 * Global queue instance (singleton)
 */
let globalQueue: AnalysisQueue | null = null;

export function getAnalysisQueue(): AnalysisQueue {
  if (!globalQueue) {
    globalQueue = new AnalysisQueue();
  }
  return globalQueue;
}
