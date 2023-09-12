import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'
import {
  appCredentialsFromString,
  getAuthOptionsForOrg,
  getAuthOptionsForRepo,
  getTokenForOrg,
  getTokenForRepo
} from '@electron/github-app-auth'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Required input
    const creds = core.getInput('creds')

    if (!creds) {
      core.setFailed("'creds' is a required input")
      return
    }

    // Optional inputs
    const org = core.getInput('org')
    let owner = core.getInput('owner')
    let repo = core.getInput('repo')
    const exportGitUser = core.getBooleanInput('export-git-user')

    if (org && (owner || repo)) {
      core.setFailed('Invalid inputs')
      return
    } else if (!org && !(owner && repo)) {
      // Use the current repo as a default
      if (!owner && !repo) {
        owner = github.context.repo.owner
        repo = github.context.repo.repo
      } else {
        core.setFailed('Invalid inputs')
        return
      }
    }

    const appCreds = appCredentialsFromString(creds)
    const token = await (org
      ? getTokenForOrg(org, appCreds)
      : getTokenForRepo({ owner, name: repo }, appCreds))

    if (!token) {
      core.setFailed('Could not generate token')
      return
    }

    core.setSecret(token)
    core.setOutput('token', token)

    // Save token to state so the post function can invalidate
    core.saveState('token', token)

    if (exportGitUser) {
      const authOpts = await (org
        ? getAuthOptionsForOrg(org, appCreds)
        : getAuthOptionsForRepo({ owner, name: repo }, appCreds))

      const appOctokit = new GitHub({ ...authOpts })

      const { data: app } = await appOctokit.rest.apps.getAuthenticated()
      const username = `${app.slug}[bot]`
      const { data: user } = await appOctokit.rest.users.getByUsername({
        username
      })
      const email = `${user.id}+${app.slug}[bot]@users.noreply.github.com`

      core.exportVariable('GIT_AUTHOR_NAME', username)
      core.exportVariable('GIT_AUTHOR_EMAIL', email)
      core.exportVariable('GIT_COMMITTER_NAME', username)
      core.exportVariable('GIT_COMMITTER_EMAIL', email)
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run()
