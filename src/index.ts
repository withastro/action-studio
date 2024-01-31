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
    const { repo, payload } = github.context
    const issue_number = payload.pull_request?.number
    core.info(JSON.stringify(payload, null, 2))

    const { success, message } = await verify();

    if (!issue_number) {
      const method = success ? 'info' : 'setFailed';
      core[method](message);
      return;
    }

    const comment = { ...repo, issue_number, body: message };
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

async function verify() {
  const root = resolve('astro', process.cwd())
  if (!root) {
    throw new Error(`Unable to locate the "astro" package. Did you remember to run install?`)
  }
  const bin = path.join(path.dirname(root), 'astro.js')
  try {
    const result = await execa(bin, ['db', 'verify'], { encoding: 'utf8', detached: true, reject: false })
    console.log(result);
    if (result.exitCode === 0) {
      return { success: true, message: 'Migrations directory is in sync!' }
    } else {
      return { success: false, message: 'Migrations directory is NOT in sync!' }
    }
  } catch (e) {
    return { success: false, message: 'Project has not been initialized!' }
  }
}

async function getCommentId(
  params: { repo: string; owner: string; issue_number: number }
) { 
  const comments = await octokit.rest.issues.listComments(params)
  const botComment = comments.data.find(
      (comment) =>
        comment.user?.login === "astro-studio-bot[bot]"
    )
    return botComment ? botComment.id : null
}

run()
