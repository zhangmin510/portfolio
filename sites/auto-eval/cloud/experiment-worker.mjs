import { executeJob } from '../src/runner.mjs';

let currentJob;
self.onmessage = async ({ data }) => {
  if (data.type === 'cancel') {
    if (currentJob) currentJob.cancelRequested = true;
    return;
  }
  if (data.type !== 'start' || currentJob) return;
  currentJob = data.job;
  if (currentJob.strategy !== 'grid') {
    self.postMessage({ type: 'error', message: '在线版仅使用本地候选搜索' });
    return;
  }
  try {
    await executeJob(currentJob, currentJob.datasetSnapshot, {
      persist: async job => self.postMessage({ type: 'step', job }),
    });
    self.postMessage({ type: 'done', job: currentJob });
  } catch {
    self.postMessage({ type: 'error', message: '实验未能完成，请重新运行' });
  }
};
