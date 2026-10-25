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
    mtprotoSession: env.MTPROTO_SESSION || '1BQANOTEuMTA4LjU2LjE1MAG7TuZJLwbfkj/iUdHC+oS7jAVGtgWv02UYOKTd1xND6DCbm5xKolC5R1FtgPJk8p81dAdbBxVCg0paPY6YSfh2yOW8FZAD4JZmDFg3r6SDHhEi6yHZ29l7JkU/xmOhzWLqvzJjwbcsm3D3mBmn6OBY+W1Mht2JLudiT28W7yyvLkocGzFx5rxPfmv/etbOP86kqRKvM2VH5lFsm/cj7Qp8Je1vAJCZnijxFKe3ph6tq+IsfnvU4JgrwK6VtTmnBaFKHbZaF2FoRBPWJBd9duAj+w3W33tYarl38r1waAPfUvnIfa4bfAl2kCx9Q4LPlzUuObv7RhzHIz2v5VNH8ED3TQ==',
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
