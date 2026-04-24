import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import {
  appCredentialsFromString,
  AuthNarrowing,
  getAuthOptionsForOrg,
  getAuthOptionsForRepo,
  getTokenForOrg,
  getTokenForRepo
} from '@electron/github-app-auth';
import * as yaml from 'js-yaml';

const PERMISSION_LEVELS = new Set(['read', 'write', 'admin']);

/**
 * Parse the `permissions` input into the object shape the GitHub REST
 * `POST /app/installations/:id/access_tokens` endpoint expects. Input is
 * parsed as YAML — typically a block map of `<permission>: <level>` — so
 * callers can express scoping inline in the same format GitHub itself uses
 * for workflow `permissions:` blocks. Returns `undefined` when the input
 * is empty, which preserves the prior unnarrowed behavior.
 */
export function parsePermissionsInput(
  input: string
): AuthNarrowing['permissions'] | undefined {
  if (!input.trim()) return undefined;

  let parsed: unknown;
  try {
    parsed = yaml.load(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not parse permissions as YAML: ${message}`);
  }

  if (parsed === null || parsed === undefined) return undefined;
  if (
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    parsed instanceof Date
  ) {
    throw new Error(
      'Permissions must be a YAML mapping of <permission>: <level>'
    );
  }

  const result: Record<string, 'read' | 'write' | 'admin'> = {};
  for (const [name, level] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    if (typeof level !== 'string' || !PERMISSION_LEVELS.has(level)) {
      throw new Error(
        `Invalid permission level "${String(level)}" for "${name}" (expected read | write | admin)`
      );
    }
    result[name] = level as 'read' | 'write' | 'admin';
  }
  return Object.keys(result).length
    ? (result as AuthNarrowing['permissions'])
    : undefined;
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Required input
    const creds = core.getInput('creds');

    if (!creds) {
      core.setFailed("'creds' is a required input");
      return;
    }

    // Optional inputs
    const org = core.getInput('org');
    let owner = core.getInput('owner');
    let repo = core.getInput('repo');
    const exportGitUser = core.getBooleanInput('export-git-user');
    const permissions = parsePermissionsInput(core.getInput('permissions'));

    if (org && (owner || repo)) {
      core.setFailed('Invalid inputs');
      return;
    } else if (!org && !(owner && repo)) {
      // Use the current repo as a default
      if (!owner && !repo) {
        owner = github.context.repo.owner;
        repo = github.context.repo.repo;
      } else {
        core.setFailed('Invalid inputs');
        return;
      }
    }

    const appCreds = appCredentialsFromString(creds);
    const authNarrowing: AuthNarrowing = permissions ? { permissions } : {};
    const token = await (org
      ? getTokenForOrg(org, appCreds, authNarrowing)
      : getTokenForRepo({ owner, name: repo }, appCreds, authNarrowing));

    if (!token) {
      core.setFailed('Could not generate token');
      return;
    }

    core.setSecret(token);
    core.setOutput('token', token);

    // Save token to state so the post function can invalidate
    core.saveState('token', token);

    if (exportGitUser) {
      const authOpts = await (org
        ? getAuthOptionsForOrg(org, appCreds)
        : getAuthOptionsForRepo({ owner, name: repo }, appCreds));

      const appOctokit = new GitHub({ ...authOpts });

      const { data: app } = await appOctokit.rest.apps.getAuthenticated();
      if (!app) {
        throw new Error('Failed to fetch authenticated app');
      }
      const username = `${app.slug}[bot]`;
      const { data: user } = await appOctokit.rest.users.getByUsername({
        username
      });
      const email = `${user.id}+${app.slug}[bot]@users.noreply.github.com`;

      core.exportVariable('GIT_AUTHOR_NAME', username);
      core.exportVariable('GIT_AUTHOR_EMAIL', email);
      core.exportVariable('GIT_COMMITTER_NAME', username);
      core.exportVariable('GIT_COMMITTER_EMAIL', email);
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
