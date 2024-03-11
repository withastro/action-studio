import * as core from "@actions/core";
import * as github from "@actions/github";
import { error } from "console";

async function run(): Promise<void> {
  const token = core.getInput("github-token");
  const octokit = github.getOctokit(token);
  const { eventName, repo, runId } = github.context;
  console.log(github.context);
  console.log(process.env);
  console.log({
    owner: repo.owner,
    repo: repo.repo,
    run_id: runId,
  });

  // On push to any branch defined in `on: ...`, run `astro db push`
  console.log("Event:", eventName);

  if (eventName !== "push") {
    return;
  }

  const jobInfo = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: repo.owner,
    repo: repo.repo,
    run_id: runId,
  });
  console.log("Jobs:", jobInfo.data.jobs);
  const job = jobInfo.data.jobs.find(
    (job) => job.name === process.env.GITHUB_JOB
  );
  console.log("Job:", job);
  if (!job) {
    return;
  }
  console.log("Job ID:", job.id);
  console.log("Job URL:", job.html_url);
  console.log("Job Status:", job.status);

  // Notify Astro Studio that this has just begin
  await fetch("https://webhook.services.astro.build/github-action/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: 'notify',
      data: {
        owner: repo.owner,
        name: repo.repo,
        url: job.html_url,
      },
    }),
  }).then(() => {
    console.log("fetch complete!");
  }).catch((error) => {
    console.error("Failed to notify:", error);
  });

  console.log("Notify complete!");

}

await run().catch((error) => {
  if ("message" in error) {
    core.setFailed(error.message);
  } else {
    core.setFailed("Unknown error: " + JSON.stringify(error));
  }
});
