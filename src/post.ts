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
      await octokit.rest.apps.revokeInstallationAccessToken();
      core.info('Token revoked');
    } catch (error) {
      // A 401 here means the token was already revoked — most commonly
      // because the caller explicitly revoked it mid-job. Treat that as
      // a successful no-op instead of a warning so the post step is
      // robust against double-revocation. Any other error still warns.
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status?: number }).status === 401
      ) {
        core.info('Token was already revoked');
      } else if (error instanceof Error) {
        core.warning(`Error while revoking token: ${error.message}`);
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
post();
