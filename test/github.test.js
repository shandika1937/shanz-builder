import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GitHubBuilderService } from '../src/services/github.js';

test('GitHubBuilderService instantiates properly', () => {
  const service = new GitHubBuilderService({
    token: 'fake_token',
    owner: 'betatest0981-bit',
    repo: 'shanz-builder'
  });

  assert.equal(service.owner, 'betatest0981-bit');
  assert.equal(service.repo, 'shanz-builder');
  assert.ok(service.octokit);
});

test('generateBuildId produces unique build ids', () => {
  const service = new GitHubBuilderService({
    token: 'fake_token',
    owner: 'betatest0981-bit',
    repo: 'shanz-builder'
  });

  const b1 = service.generateBuildId('flutter', '12345');
  const b2 = service.generateBuildId('html', '12345');
  assert.ok(b1.startsWith('flutter-12345-'));
  assert.ok(b2.startsWith('html-12345-'));
  assert.notEqual(b1, b2);
});
