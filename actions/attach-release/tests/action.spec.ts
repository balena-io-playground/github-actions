import * as path from 'path';
// Set GITHUB_EVENT_PATH right away so @actions modules will initilize correctly
process.env['GITHUB_EVENT_PATH'] = path.resolve('./tests/sample_event.json');
import rewire = require('rewire');
import { spy, stub } from 'sinon';
import * as core from '@actions/core';
import * as github from '@actions/github';

import { expect } from './lib/chai';

// Rewire the module so we can access private variables
const action = rewire('../src/action');

describe('attach-release action', async () => {
	const octoStub = stub(github, 'getOctokit');
	const setOutputSpy = spy(core, 'setOutput');
	const releaseId = '1810396';
	const targetName = 'build release';
	const githubToken = 'gh123';
	const repoOwner = 'Codertocat';
	const repoName = 'Hello-World';
	const pullRequestSha = 'ec26c3e57ca3a959ca5aad62de7213c562f8c821';

	before(() => {
		process.env['INPUT_RELEASE_ID'] = releaseId;
		process.env['INPUT_TARGET_NAME'] = targetName;
		process.env['INPUT_GITHUB_TOKEN'] = githubToken;
	});

	beforeEach(() => {
		octoStub.resetHistory();
		setOutputSpy.resetHistory();
	});

	after(() => {
		octoStub.restore();
		setOutputSpy.restore();
	});

	it('uses correct inputs', async () => {
		const targetCheckId = 12345;
		const getTargetCheckStub = stub().resolves({
			id: targetCheckId,
			name: 'build release',
			output: {
				title: 'Build release',
				summary: 'Succssfully built a new release!',
				text: '1810396',
			},
		});
		const getTargetCheckRestore = action.__set__(
			'getTargetCheck',
			getTargetCheckStub,
		);
		const updateRunStub = stub().resolves();
		const updateRunRestore = action.__set__('updateRun', updateRunStub);
		// Run action
		await action.__get__('run')();
		// Check correct inputs were used
		expect(octoStub.args[0][0]).to.equal(githubToken);
		expect(getTargetCheckStub.args[0]).to.have.members([
			repoOwner,
			repoName,
			pullRequestSha,
			'build release',
		]);
		expect(updateRunStub.args[0]).to.have.members([
			targetCheckId,
			repoOwner,
			repoName,
			releaseId,
		]);
		// Restore
		getTargetCheckRestore();
		updateRunRestore();
	});

	it('gets target check run', async () => {
		const getCheckRunsRestore = action.__set__(
			'getCheckRuns',
			stub().resolves({
				check_runs: [
					{
						name: 'another workflow',
						output: {
							title: '',
							summary: '',
							text: '',
						},
					},
					{
						name: 'build release',
						output: {
							title: '',
							summary: '',
							text: '',
						},
					},
				],
			}),
		);
		// Check correct run is returned
		await expect(
			action.__get__('getTargetCheck')(
				repoOwner,
				repoName,
				pullRequestSha,
				targetName,
			),
		).to.eventually.deep.equal({
			name: 'build release',
			output: {
				title: '',
				summary: '',
				text: '',
			},
		});
		// Restore
		getCheckRunsRestore();
	});
});
