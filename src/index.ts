import * as core from '@actions/core'
import { cli } from '@astrojs/db';

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run(): Promise<void> {
  try {
    const input: string = core.getInput('input')

    await cli({ flags: ['verify'], config: {} })

    // Set outputs for other workflow steps to use
    core.setOutput('value', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run();
