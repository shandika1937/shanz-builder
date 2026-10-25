import { Octokit } from '@octokit/rest';
import AdmZip from 'adm-zip';

export class GitHubBuilderService {
  constructor({ token, owner, repo }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.octokit = new Octokit({
      auth: token
    });
  }

  generateBuildId(type, userId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `build/${type}-${userId}-${timestamp}-${random}`;
  }

  async getDefaultBranchSha() {
    const { data: repoInfo } = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo
    });
    const defaultBranch = repoInfo.default_branch || 'main';

    const { data: refData } = await this.octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${defaultBranch}`
    });

    return {
      sha: refData.object.sha,
      defaultBranch
    };
  }

  async triggerBuild({ branchName, zipBuffer, metadata = {} }) {
    const { sha: baseSha } = await this.getDefaultBranchSha();

    // 1. Create temporary build branch
    await this.octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });

    // 2. Upload build metadata (type, appName, version)
    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: 'build-info.json',
      message: `Setup build metadata [${branchName}]`,
      content: Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64'),
      branch: branchName
    });

    // 3. Upload project payload.zip (triggers GitHub Actions on branch)
    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: 'payload.zip',
      message: `Trigger Cloud APK Build [${branchName}]`,
      content: zipBuffer.toString('base64'),
      branch: branchName
    });

    return {
      branchName,
      status: 'triggered'
    };
  }

  async waitForWorkflowRun(branchName, onProgress = () => {}, timeoutMs = 15 * 60 * 1000) {
    const startTime = Date.now();
    let runId = null;

    while (Date.now() - startTime < timeoutMs) {
      if (!runId) {
        const { data } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
          owner: this.owner,
          repo: this.repo,
          branch: branchName
        });

        if (data.workflow_runs && data.workflow_runs.length > 0) {
          runId = data.workflow_runs[0].id;
        }
      }

      if (runId) {
        const { data: run } = await this.octokit.rest.actions.getWorkflowRun({
          owner: this.owner,
          repo: this.repo,
          run_id: runId
        });

        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        onProgress({
          status: run.status,
          conclusion: run.conclusion,
          runId: run.id,
          htmlUrl: run.html_url,
          elapsedSec
        });

        if (run.status === 'completed') {
          return run;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 8000));
    }

    throw new Error('Build timed out after 15 minutes.');
  }

  async downloadApkArtifact(runId) {
    const { data: artifactsData } = await this.octokit.rest.actions.listWorkflowRunArtifacts({
      owner: this.owner,
      repo: this.repo,
      run_id: runId
    });

    if (!artifactsData.artifacts || artifactsData.artifacts.length === 0) {
      throw new Error('Tidak ada artifact APK yang dihasilkan dari build ini.');
    }

    const apkArtifact = artifactsData.artifacts.find(
      a => a.name.includes('apk') || a.name.includes('app')
    ) || artifactsData.artifacts[0];

    const response = await this.octokit.rest.actions.downloadArtifact({
      owner: this.owner,
      repo: this.repo,
      artifact_id: apkArtifact.id,
      archive_format: 'zip'
    });

    const zipBuffer = Buffer.from(response.data);
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const apkEntry = entries.find(e => e.entryName.endsWith('.apk'));
    if (!apkEntry) {
      throw new Error('File .apk tidak ditemukan di dalam artifact build.');
    }

    const apkBuffer = apkEntry.getData();
    return {
      fileName: apkEntry.name || 'app-release.apk',
      apkBuffer,
      fileSize: apkBuffer.length,
      directUrl: apkArtifact.archive_download_url
    };
  }

  async deleteBuildBranch(branchName) {
    try {
      await this.octokit.rest.git.deleteRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branchName}`
      });
    } catch {
      // Ignore if branch already deleted
    }
  }
}
