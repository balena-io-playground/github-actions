import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/core';
import { PaginateInterface } from '@octokit/plugin-paginate-rest';
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types';

let octokit: Octokit & Api & { paginate: PaginateInterface };

type CheckRun = {
	id: number;
	name: string;
	output: {
		title: string;
		summary: string;
		text: string;
	};
};

export async function run(): Promise<void> {
	// Check that context contains required data
	if (!github.context.payload.pull_request) {
		throw new Error('Context is missing pull_request data.');
	} else if (!github.context.payload.repository) {
		throw new Error('Context is missing repository data.');
	}
	const releaseId = core.getInput('release_id', { required: true });
	// Get configured client for making requests to GH
	const token = core.getInput('github_token', { required: true });
	octokit = github.getOctokit(token);
	// Find target check
	const target = await getTargetCheck(
		github.context.payload.repository.owner.login,
		github.context.payload.repository.name,
		github.context.payload.pull_request.head.sha,
		core.getInput('target_name', { required: true }),
	);
	// Add the releaseId to the target check
	await updateRun(
		target.id,
		github.context.payload.repository.owner.login,
		github.context.payload.repository.name,
		releaseId,
	);
}

async function updateRun(
	runId: number,
	owner: string,
	repo: string,
	releaseId: string,
) {
	await octokit.request(
		'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}',
		{
			owner,
			repo,
			check_run_id: runId,
			output: {
				title: 'Build release',
				summary: 'Succssfully built a new release!',
				text: releaseId,
			},
		},
	);
}

async function getTargetCheck(
	owner: string,
	repo: string,
	sha: string,
	target: string,
): Promise<CheckRun> {
	// Get the checks for this commit
	const checks = await getCheckRuns(owner, repo, sha);
	// Find run where name matches target
	const check = checks.check_runs.filter((c: CheckRun) => c.name === target)[0];
	if (!check) {
		throw new Error(
			`Unable to find target ${target} in checks ran on commit ${sha}.`,
		);
	}
	return check;
}

async function getCheckRuns(owner: string, repo: string, sha: string) {
	return (
		await octokit.request(
			'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
			{
				owner,
				repo,
				ref: sha,
			},
		)
	).data;
}
