import * as core from '@actions/core'
import * as github from '@actions/github'

import path from 'node:path'
import resolve from 'resolve-package-path'
import { execa } from 'execa'

const UNIQUE_IDENTIFIER = '<!-- @astrojs/action-studio -->';

async function run(): Promise<void> {
    const token = core.getInput('github-token')
    const octokit = github.getOctokit(token)
    const { eventName, repo, runId } = github.context;
    console.log(github.context);
    console.log(process.env);
    console.log({
      owner: repo.owner,
      repo: repo.repo,
      run_id: runId
    });

    // On push to any branch defined in `on: ...`, run `astro db push`
    console.log('Event:', eventName);
    
    if (eventName !== 'push') {
      return;
    }

    const jobInfo = await octokit.rest.actions.listJobsForWorkflowRun({
      owner: repo.owner,
      repo: repo.repo,
      run_id: runId
    });
    console.log('Job info:', jobInfo);
    const job = jobInfo.data.jobs.find(job => job.name === 'build');
    console.log('Job:', job);
    if (!job) {
      return;
    }
    const job_id = job.id;
    const html_url = job.html_url;
    console.log('Job ID:', job_id);
    console.log('Job URL:', html_url);
}


run().catch((error) => {
  if ('message' in error) {
    core.setFailed(error.message)
  } else {
    core.setFailed('Unknown error: ' + JSON.stringify(error))
  }
});
