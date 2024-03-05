import * as core from '@actions/core'
import * as github from '@actions/github'

import path from 'node:path'
import resolve from 'resolve-package-path'
import { execa } from 'execa'

let octokit: ReturnType<typeof github['getOctokit']>;
async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token')
    octokit = github.getOctokit(token)
    const { eventName, repo, payload } = github.context

    // On push to default branch, push to Astro Studio
    if (eventName === 'push' && payload.ref === `refs/heads/${payload.repository?.default_branch ?? 'main'}`) {
      await push();
      return;
    }

    // Otherwise, run verify and leave a PR comment
    const issue_number = payload.pull_request?.number
    const verifyResult = await verify(github.context);
    const formattedMessage = formatVerifyResult(verifyResult);

    // TODO: different message for success vs. failure
    if (!issue_number) {
      const method = verifyResult.success ? 'info' : 'setFailed';
      core[method](formattedMessage);
      return;
    }

    const comment = { ...repo, issue_number, body: formattedMessage };
    const comment_id = await getCommentId({ ...repo, issue_number })

    if (comment_id) {
      await octokit.rest.issues.updateComment({
        ...comment,
        comment_id
      })
    } else {
      await octokit.rest.issues.createComment({
        ...comment,
      })
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function push() {
  const root = resolve('astro', process.cwd())
  if (!root) {
    throw new Error(`Unable to locate the "astro" package. Did you remember to run install?`)
  }
  const bin = path.join(path.dirname(root), 'astro.js')
  await execa(bin, ['db', 'push'], { encoding: 'utf8', detached: true, reject: false })
}

async function verify(context: typeof github.context) {
  const root = resolve('astro', process.cwd())
  if (!root) {
    throw new Error(`Unable to locate the "astro" package. Did you remember to run install?`)
  }
  const bin = path.join(path.dirname(root), 'astro.js')
  const{ all, exitCode } = await execa(bin, ['db', 'verify'], { encoding: 'utf8', detached: true, reject: false, all: true })
  if (exitCode === 0) {
    return { success: true, message: all.toString() }
  } else {
    return { success: false, message: all.toString() }
  }
}

function formatVerifyResult({ success, message }: { success: boolean, message: string }) {
  // TODO: Format this message 
  return message;
}

function getAddMigrationURL(context: typeof github.context, status: any) {
  return `${context.payload.pull_request!.head.repo.html_url}/new/${context.payload.pull_request!.head.ref}?filename=migrations/${status.newFilename}&value=${encodeURIComponent(status.newFileContent)}`;
}

async function getCommentId(
  params: { repo: string; owner: string; issue_number: number }
) {
  const comments = await octokit.rest.issues.listComments(params)
  const botComment = comments.data.find(
    (comment) =>
      comment.user?.login === "github-actions[bot]" &&
      comment.body_text?.toLowerCase().includes('migration')
  )
  return botComment ? botComment.id : null
}

run()
