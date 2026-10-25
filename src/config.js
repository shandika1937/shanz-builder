import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

export function loadConfig(env = process.env) {
  const botToken = env.BOT_TOKEN;
  const ownerId = env.OWNER_ID;
  const coOwnerId = env.CO_OWNER_ID;
  const githubToken = env.GITHUB_TOKEN;
  const githubRepo = env.GITHUB_REPO;

  if (!botToken) {
    throw new Error('Missing required environment variable: BOT_TOKEN');
  }
  if (!ownerId) {
    throw new Error('Missing required environment variable: OWNER_ID');
  }
  if (!githubToken) {
    throw new Error('Missing required environment variable: GITHUB_TOKEN');
  }
  if (!githubRepo) {
    throw new Error('Missing required environment variable: GITHUB_REPO');
  }

  const [repoOwner, repoName] = githubRepo.split('/');
  if (!repoOwner || !repoName) {
    throw new Error('GITHUB_REPO must be in format "owner/repo"');
  }

  return {
    botToken,
    ownerId: String(ownerId),
    coOwnerId: coOwnerId ? String(coOwnerId) : '8728564869',
    githubToken,
    githubRepo,
    repoOwner,
    repoName,
    apiId: env.API_ID ? Number(env.API_ID) : 30633789,
    apiHash: env.API_HASH || '3b93bdf4356597735ba0946ed55294f6',
    tempDir: path.resolve(env.TEMP_DIR || './temp'),
    pollIntervalMs: Number(env.POLL_INTERVAL_MS || 10000),
    maxBuildWaitMs: Number(env.MAX_BUILD_WAIT_MS || 15 * 60 * 1000)
  };
}

export const config = (() => {
  try {
    return loadConfig();
  } catch {
    return null;
  }
})();
