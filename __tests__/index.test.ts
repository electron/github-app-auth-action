import * as core from '@actions/core'
import {
  appCredentialsFromString,
  getTokenForOrg,
  getTokenForRepo
} from '@electron/github-app-auth'

import * as index from '../src/index'
import { GitHub } from '@actions/github/lib/utils'

jest.mock('@actions/core', () => {
  return {
    exportVariable: jest.fn(),
    getBooleanInput: jest.fn(),
    getInput: jest.fn(),
    getState: jest.fn(),
    info: jest.fn(),
    saveState: jest.fn(),
    setFailed: jest.fn(),
    setOutput: jest.fn(),
    setSecret: jest.fn()
  }
})
jest.mock('@actions/github', () => {
  return {
    context: {
      repo: {
        owner: 'electron',
        repo: 'electron'
      }
    }
  }
})
jest.mock('@actions/github/lib/utils')
jest.mock('@electron/github-app-auth')

jest
  .mocked(appCredentialsFromString)
  .mockReturnValue({ appId: '12345', privateKey: 'private' })

const getAuthenticated = jest.fn()
const getByUsername = jest.fn()

;(GitHub as unknown as jest.Mock).mockReturnValue({
  rest: {
    apps: {
      getAuthenticated
    },
    users: {
      getByUsername
    }
  }
})

// Spy the action's entrypoint
const runSpy = jest.spyOn(index, 'run')

const slug = 'my-app'
const userId = 12345
const username = `${slug}[bot]`
const email = `${userId}+${slug}[bot]@users.noreply.github.com`

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('requires the creds input', async () => {
    jest.mocked(core.getInput).mockReturnValue('')

    await index.run()
    expect(runSpy).toHaveReturned()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenLastCalledWith(
      "'creds' is a required input"
    )
  })

  it('requires both owner and repo inputs if either provided', async () => {
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        case 'owner':
          return 'electron'
        default:
          return ''
      }
    })

    await index.run()
    expect(runSpy).toHaveReturned()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenLastCalledWith('Invalid inputs')
  })

  it('rejects invalid inputs', async () => {
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        case 'owner':
          return 'electron'
        case 'org':
          return 'electron'
        default:
          return ''
      }
    })

    await index.run()
    expect(runSpy).toHaveReturned()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenLastCalledWith('Invalid inputs')
  })

  it('defaults to the current repo on no inputs', async () => {
    const token = 'repo-token'
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        default:
          return ''
      }
    })
    jest.mocked(getTokenForRepo).mockResolvedValue(token)

    await index.run()
    expect(runSpy).toHaveReturned()

    expect(getTokenForRepo).toHaveBeenCalledTimes(1)
    expect(getTokenForRepo).toHaveBeenLastCalledWith(
      { owner: 'electron', name: 'electron' },
      expect.anything()
    )

    // Marks the token as a secret
    expect(core.setSecret).toHaveBeenCalledTimes(1)
    expect(core.setSecret).toHaveBeenLastCalledWith(token)

    // Sets the output
    expect(core.setOutput).toHaveBeenCalledTimes(1)
    expect(core.setOutput).toHaveBeenLastCalledWith('token', token)

    // Saves the token for invalidation
    expect(core.saveState).toHaveBeenCalledTimes(1)
    expect(core.saveState).toHaveBeenLastCalledWith('token', token)
  })

  it('generates a repo token', async () => {
    const token = 'repo-token'
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        case 'owner':
          return 'electron'
        case 'repo':
          return 'fake-repo'
        default:
          return ''
      }
    })
    jest.mocked(getTokenForRepo).mockResolvedValue(token)

    await index.run()
    expect(runSpy).toHaveReturned()

    expect(getTokenForRepo).toHaveBeenCalledTimes(1)
    expect(getTokenForRepo).toHaveBeenLastCalledWith(
      { owner: 'electron', name: 'fake-repo' },
      expect.anything()
    )

    // Marks the token as a secret
    expect(core.setSecret).toHaveBeenCalledTimes(1)
    expect(core.setSecret).toHaveBeenLastCalledWith(token)

    // Sets the output
    expect(core.setOutput).toHaveBeenCalledTimes(1)
    expect(core.setOutput).toHaveBeenLastCalledWith('token', token)

    // Saves the token for invalidation
    expect(core.saveState).toHaveBeenCalledTimes(1)
    expect(core.saveState).toHaveBeenLastCalledWith('token', token)
  })

  it('can export a git user with repo token', async () => {
    const token = 'repo-token'
    jest.mocked(core.getBooleanInput).mockReturnValue(true)
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        case 'owner':
          return 'electron'
        case 'repo':
          return 'fake-repo'
        default:
          return ''
      }
    })
    jest.mocked(getTokenForRepo).mockResolvedValue(token)
    jest.mocked(getAuthenticated).mockResolvedValue({ data: { slug } })
    jest.mocked(getByUsername).mockResolvedValue({
      data: {
        id: userId
      }
    })

    await index.run()
    expect(runSpy).toHaveReturned()

    // Exports git user environment variables
    expect(core.exportVariable).toHaveBeenCalledTimes(4)
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_AUTHOR_NAME',
      username
    )
    expect(core.exportVariable).toHaveBeenCalledWith('GIT_AUTHOR_EMAIL', email)
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_COMMITTER_NAME',
      username
    )
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_COMMITTER_EMAIL',
      email
    )
  })

  it('generates an org token', async () => {
    const token = 'org-token'
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        case 'org':
          return 'electron'
        default:
          return ''
      }
    })
    jest.mocked(getTokenForOrg).mockResolvedValue(token)

    await index.run()
    expect(runSpy).toHaveReturned()

    expect(getTokenForOrg).toHaveBeenCalledTimes(1)
    expect(getTokenForOrg).toHaveBeenLastCalledWith(
      'electron',
      expect.anything()
    )

    // Marks the token as a secret
    expect(core.setSecret).toHaveBeenCalledTimes(1)
    expect(core.setSecret).toHaveBeenLastCalledWith(token)

    // Sets the output
    expect(core.setOutput).toHaveBeenCalledTimes(1)
    expect(core.setOutput).toHaveBeenLastCalledWith('token', token)

    // Saves the token for invalidation
    expect(core.saveState).toHaveBeenCalledTimes(1)
    expect(core.saveState).toHaveBeenLastCalledWith('token', token)
  })

  it('can export a git user with org token', async () => {
    const token = 'org-token'
    jest.mocked(core.getBooleanInput).mockReturnValue(true)
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        case 'org':
          return 'electron'
        default:
          return ''
      }
    })
    jest.mocked(getTokenForOrg).mockResolvedValue(token)
    jest.mocked(getAuthenticated).mockResolvedValue({ data: { slug } })
    jest.mocked(getByUsername).mockResolvedValue({
      data: {
        id: userId
      }
    })

    await index.run()
    expect(runSpy).toHaveReturned()

    // Exports git user environment variables
    expect(core.exportVariable).toHaveBeenCalledTimes(4)
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_AUTHOR_NAME',
      username
    )
    expect(core.exportVariable).toHaveBeenCalledWith('GIT_AUTHOR_EMAIL', email)
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_COMMITTER_NAME',
      username
    )
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_COMMITTER_EMAIL',
      email
    )
  })

  it('handles token generate failure', async () => {
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        case 'org':
          return 'electron'
        default:
          return ''
      }
    })
    jest.mocked(getTokenForOrg).mockResolvedValue(null)

    await index.run()
    expect(runSpy).toHaveReturned()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenLastCalledWith('Could not generate token')
  })

  it('handles an unexpected error', async () => {
    const message = 'Server Error'
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar'
        case 'org':
          return 'electron'
        default:
          return ''
      }
    })
    jest.mocked(getTokenForOrg).mockRejectedValue(new Error(message))

    await index.run()
    expect(runSpy).toHaveReturned()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
    expect(core.setFailed).toHaveBeenLastCalledWith(message)
  })
})
