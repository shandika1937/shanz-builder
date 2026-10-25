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
    return `${type}-${userId}-${timestamp}-${random}`;
  }

  async triggerBuild({ buildId, type, buildMode = 'release', appName = 'app', zipBuffer }) {
    const releaseTag = `build-${buildId}`;

    // 1. Create temporary Release on main
    const { data: release } = await this.octokit.rest.repos.createRelease({
      owner: this.owner,
      repo: this.repo,
      tag_name: releaseTag,
      name: `Build ${appName} [${buildId}]`,
      body: `Cloud APK build for ${appName} (${buildMode})`,
      draft: false,
      prerelease: true
    });

    // 2. Upload raw binary payload.zip directly to release (fast & safe)
    await this.octokit.rest.repos.uploadReleaseAsset({
      owner: this.owner,
      repo: this.repo,
      release_id: release.id,
      name: 'payload.zip',
      data: zipBuffer,
      headers: {
        'content-type': 'application/zip',
        'content-length': zipBuffer.length
      }
    });

    // 3. Dispatch workflow on main
    const workflowFile = type === 'flutter' ? 'build-flutter.yml' : 'build-html.yml';
    await this.octokit.rest.actions.createWorkflowDispatch({
      owner: this.owner,
      repo: this.repo,
      workflow_id: workflowFile,
      ref: 'main',
      inputs: {
        build_id: buildId,
        release_tag: releaseTag,
        build_type: buildMode,
        app_name: appName
      }
    });

    return {
      releaseId: release.id,
      releaseTag,
      status: 'triggered'
    };
  }

  async waitForWorkflowRun({ releaseTag, type }, onProgress = () => {}, timeoutMs = 15 * 60 * 1000) {
    const startTime = Date.now();
    let runId = null;
    const workflowFile = type === 'flutter' ? 'build-flutter.yml' : 'build-html.yml';

    while (Date.now() - startTime < timeoutMs) {
      if (!runId) {
        const { data } = await this.octokit.rest.actions.listWorkflowRuns({
          owner: this.owner,
          repo: this.repo,
          workflow_id: workflowFile,
          event: 'workflow_dispatch'
        });

        if (data.workflow_runs && data.workflow_runs.length > 0) {
          const recentRun = data.workflow_runs.find(r => (Date.now() - new Date(r.created_at).getTime()) < 120000);
          if (recentRun) {
            runId = recentRun.id;
          }
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

      await new Promise(resolve => setTimeout(resolve, 6000));
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

  async cleanupBuild({ releaseId, releaseTag }) {
    if (releaseId) {
      try {
        await this.octokit.rest.repos.deleteRelease({
          owner: this.owner,
          repo: this.repo,
          release_id: releaseId
        });
      } catch {}
    }
    if (releaseTag) {
      try {
        await this.octokit.rest.git.deleteRef({
          owner: this.owner,
          repo: this.repo,
          ref: `tags/${releaseTag}`
        });
      } catch {}
    }
  }
}
