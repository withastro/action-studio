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
    console.log({ eventName, payload });
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

async function push() {
  const root = resolve('astro', process.cwd())
  if (!root) {
    throw new Error(`Unable to locate the "astro" package. Did you remember to run install?`)
  }
  const bin = path.join(path.dirname(root), 'astro.js')
  await execa(bin, ['db', 'push'], { encoding: 'utf8', detached: true, reject: false })
}

async function verify() {
  const root = resolve('astro', process.cwd())
  if (!root) {
    throw new Error(`Unable to locate the "astro" package. Did you remember to run install?`)
  }
  const bin = path.join(path.dirname(root), 'astro.js')
  const { stdout } = await execa(bin, ['db', 'verify', '--json'], { encoding: 'utf8', detached: true, reject: false })
  const status = JSON.parse(stdout);
  switch (status.state) {
    case 'no-migrations-found': return { success: false, message: 'No migrations found!\nTo scaffold your migrations folder, run `astro db sync`.\n' }
		case 'ahead': return { success: false, message: 'Changes detected! To create the necessary migration file, run `astro db sync`.\n' }
		case 'up-to-date': return { success: true, message: 'No migrations needed!\nYour database is up to date.' }
  }
  return { success: false, message: 'Unable to run `astro db verify`! Does your action install the `astro` package?' }
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
