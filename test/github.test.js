import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GitHubBuilderService } from '../src/services/github.js';

test('GitHubBuilderService instantiates properly', () => {
  const service = new GitHubBuilderService({
    token: 'fake_token',
    owner: 'okegash4-dev',
    repo: 'shanz-builder'
  });

  assert.equal(service.owner, 'okegash4-dev');
  assert.equal(service.repo, 'shanz-builder');
  assert.ok(service.octokit);
});

test('generateBuildId produces unique branch names', () => {
  const service = new GitHubBuilderService({
    token: 'fake_token',
    owner: 'okegash4-dev',
    repo: 'shanz-builder'
  });

  const b1 = service.generateBuildId('flutter', '12345');
  const b2 = service.generateBuildId('html', '12345');
  assert.ok(b1.startsWith('build/flutter-12345-'));
  assert.ok(b2.startsWith('build/html-12345-'));
  assert.notEqual(b1, b2);
});
