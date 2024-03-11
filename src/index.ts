import * as core from "@actions/core";
import * as github from "@actions/github";

import path from "node:path";
import resolve from "resolve-package-path";
import { execa } from "execa";

const UNIQUE_IDENTIFIER = "<!-- @astrojs/action-studio -->";

async function run(): Promise<void> {
  const token = core.getInput("github-token");
  const octokit = github.getOctokit(token);
  const { eventName, repo, payload } = github.context;
  // On push to any branch defined in `on: ...`, run `astro db push`
  console.log("Event:", eventName);
  if (eventName === "push") {
    await push();
    return;
  }

  // Otherwise, run verify and leave a PR comment
  const verifyResult = await verify(github.context);
  console.log('Verify:', verifyResult);
  const formattedMessage = formatVerifyResult(verifyResult);
  console.log('Verify Message:', verifyResult);

  // TODO: different message for success vs. failure
  const issue_number = payload.pull_request?.number;
  if (!issue_number) {
    const method = verifyResult.success ? "info" : "setFailed";
    core[method](formattedMessage);
    return;
  }

  const comment = { ...repo, issue_number, body: formattedMessage };
  const comments = await octokit.rest.issues.listComments({
    ...repo,
    issue_number,
  });
  const comment_id = await getCommentId(comments.data);

  if (comment_id) {
    await octokit.rest.issues.updateComment({
      ...comment,
      comment_id,
    });
  } else {
    await octokit.rest.issues.createComment({
      ...comment,
    });
  }
}

async function push() {
  const root = resolve("astro", process.cwd());
  if (!root) {
    throw new Error(
      `Unable to locate the "astro" package. Did you remember to run install?`
    );
  }
  const bin = path.join(path.dirname(root), "astro.js");
  console.log("Pushing database schema...");
  await execa(bin, ["db", "push"], {
    encoding: "utf8",
    detached: true,
    stdio: "inherit",
  });
}

async function verify(context: typeof github.context) {
  const root = resolve("astro", process.cwd());
  if (!root) {
    throw new Error(
      `Unable to locate the "astro" package. Did you remember to run install?`
    );
  }
  const bin = path.join(path.dirname(root), "astro.js");
  const { stdout } = await execa(bin, ["db", "verify", "--json"], {
    encoding: "utf8",
    detached: true,
    stdout: "pipe",
    stderr: "inherit",
  });
  console.log(stdout);
  const result = JSON.parse(stdout.toString());
  return result;
}

// TODO: Format these messages better
function formatVerifyResult(result: {
  code: string;
  message: string;
  data: unknown;
}) {
  const { code, message, data } = result;
  if (code === "MATCH") {
    return "Your database schema is up-to-date.";
  }
  if (code === "NO_MATCH") {
    return "Your database schema is ahead of production database.\nIt can be automatically migrated by Astro.";
  }
  if (code === "DATA_LOSS") {
    return message;
  }
  return "Unknown error: " + JSON.stringify(result);
}

function getCommentId(
  comments: { user: { login: string } | null; body?: string; id: number }[]
) {
  const botComment = comments.find(
    (comment) =>
      comment.user?.login === "github-actions[bot]" &&
      comment.body?.toLowerCase().includes(UNIQUE_IDENTIFIER)
  );
  return botComment ? botComment.id : null;
}

run().catch((error) => {
  if ("message" in error) {
    core.setFailed(error.message);
  } else {
    core.setFailed("Unknown error: " + JSON.stringify(error));
  }
});
