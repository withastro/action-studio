import { a as coreExports, b as getOctokit_1, e as context } from './github-b307e6bd.mjs';
import 'os';
import 'fs';
import 'path';
import 'http';
import 'https';
import 'net';
import 'tls';
import 'events';
import 'assert';
import 'util';
import 'module';
import 'stream';
import 'buffer';
import 'querystring';
import 'stream/web';
import 'node:stream';
import 'node:util';
import 'node:events';
import 'worker_threads';
import 'perf_hooks';
import 'util/types';
import 'async_hooks';
import 'console';
import 'url';
import 'zlib';
import 'string_decoder';
import 'diagnostics_channel';

async function run() {
  const token = coreExports.getInput("github-token");
  const octokit = getOctokit_1(token);
  const { eventName, repo, runId } = context;
  console.log(context);
  console.log(process.env);
  console.log({
    owner: repo.owner,
    repo: repo.repo,
    run_id: runId
  });
  console.log("Event:", eventName);
  if (eventName !== "push") {
    return;
  }
  const jobInfo = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: repo.owner,
    repo: repo.repo,
    run_id: runId
  });
  console.log("Jobs:", jobInfo.data.jobs);
  const job = jobInfo.data.jobs.find(
    (job2) => job2.name === process.env.GITHUB_JOB
  );
  console.log("Job:", job);
  if (!job) {
    return;
  }
  console.log("Job ID:", job.id);
  console.log("Job URL:", job.html_url);
  console.log("Job Status:", job.status);
  await fetch("https://webhook.services.astro.build/github-action/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      data: {
        owner: repo.owner,
        name: repo.repo,
        url: job.html_url
      }
    })
  });
}
run().catch((error) => {
  if ("message" in error) {
    coreExports.setFailed(error.message);
  } else {
    coreExports.setFailed("Unknown error: " + JSON.stringify(error));
  }
});
