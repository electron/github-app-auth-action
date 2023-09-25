import * as core from '@actions/core';
import * as github from '@actions/github';

/**
 * The post function for the action.
 * @returns {Promise<void>} Resolves when the post function is complete.
 */
export async function post(): Promise<void> {
  const token = core.getState('token');

  if (token) {
    try {
      const octokit = github.getOctokit(token);
      octokit.rest.apps.revokeInstallationAccessToken();
      core.info('Token revoked');
    } catch (error) {
      if (error instanceof Error)
        core.warning(`Error while revoking token: ${error.message}`);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
post();
