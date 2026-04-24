import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as core from '@actions/core';
import {
  appCredentialsFromString,
  getTokenForOrg,
  getTokenForRepo
} from '@electron/github-app-auth';

import * as index from '../src/index';
import { GitHub } from '@actions/github/lib/utils';

vi.mock('@actions/core');
vi.mock('@actions/github', () => {
  return {
    context: {
      repo: {
        owner: 'electron',
        repo: 'electron'
      }
    }
  };
});
vi.mock('@actions/github/lib/utils');
vi.mock('@electron/github-app-auth');

vi.mocked(appCredentialsFromString).mockReturnValue({
  appId: '12345',
  privateKey: 'private'
});

const getAuthenticated = vi.fn();
const getByUsername = vi.fn();

vi.mocked(GitHub).mockImplementation(
  class {
    rest = {
      apps: {
        getAuthenticated
      },
      users: {
        getByUsername
      }
    };
  } as unknown as typeof GitHub
);

// Spy the action's entrypoint
const runSpy = vi.spyOn(index, 'run');

const slug = 'my-app';
const userId = 12345;
const username = `${slug}[bot]`;
const email = `${userId}+${slug}[bot]@users.noreply.github.com`;

describe('action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires the creds input', async () => {
    vi.mocked(core.getInput).mockReturnValue('');

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenLastCalledWith(
      "'creds' is a required input"
    );
  });

  it('requires both owner and repo inputs if either provided', async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'owner':
          return 'electron';
        default:
          return '';
      }
    });

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenLastCalledWith('Invalid inputs');
  });

  it('rejects invalid inputs', async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'owner':
          return 'electron';
        case 'org':
          return 'electron';
        default:
          return '';
      }
    });

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenLastCalledWith('Invalid inputs');
  });

  it('defaults to the current repo on no inputs', async () => {
    const token = 'repo-token';
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForRepo).mockResolvedValue(token);

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(getTokenForRepo).toHaveBeenCalledTimes(1);
    expect(getTokenForRepo).toHaveBeenLastCalledWith(
      { owner: 'electron', name: 'electron' },
      expect.anything(),
      {}
    );

    // Marks the token as a secret
    expect(core.setSecret).toHaveBeenCalledTimes(1);
    expect(core.setSecret).toHaveBeenLastCalledWith(token);

    // Sets the output
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenLastCalledWith('token', token);

    // Saves the token for invalidation
    expect(core.saveState).toHaveBeenCalledTimes(1);
    expect(core.saveState).toHaveBeenLastCalledWith('token', token);
  });

  it('generates a repo token', async () => {
    const token = 'repo-token';
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'owner':
          return 'electron';
        case 'repo':
          return 'fake-repo';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForRepo).mockResolvedValue(token);

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(getTokenForRepo).toHaveBeenCalledTimes(1);
    expect(getTokenForRepo).toHaveBeenLastCalledWith(
      { owner: 'electron', name: 'fake-repo' },
      expect.anything(),
      {}
    );

    // Marks the token as a secret
    expect(core.setSecret).toHaveBeenCalledTimes(1);
    expect(core.setSecret).toHaveBeenLastCalledWith(token);

    // Sets the output
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenLastCalledWith('token', token);

    // Saves the token for invalidation
    expect(core.saveState).toHaveBeenCalledTimes(1);
    expect(core.saveState).toHaveBeenLastCalledWith('token', token);
  });

  it('can export a git user with repo token', async () => {
    const token = 'repo-token';
    vi.mocked(core.getBooleanInput).mockReturnValue(true);
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'owner':
          return 'electron';
        case 'repo':
          return 'fake-repo';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForRepo).mockResolvedValue(token);
    vi.mocked(getAuthenticated).mockResolvedValue({ data: { slug } });
    vi.mocked(getByUsername).mockResolvedValue({
      data: {
        id: userId
      }
    });

    await index.run();
    expect(runSpy).toHaveReturned();

    // Exports git user environment variables
    expect(core.exportVariable).toHaveBeenCalledTimes(4);
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_AUTHOR_NAME',
      username
    );
    expect(core.exportVariable).toHaveBeenCalledWith('GIT_AUTHOR_EMAIL', email);
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_COMMITTER_NAME',
      username
    );
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_COMMITTER_EMAIL',
      email
    );
  });

  it('generates an org token', async () => {
    const token = 'org-token';
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'org':
          return 'electron';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForOrg).mockResolvedValue(token);

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(getTokenForOrg).toHaveBeenCalledTimes(1);
    expect(getTokenForOrg).toHaveBeenLastCalledWith(
      'electron',
      expect.anything(),
      {}
    );

    // Marks the token as a secret
    expect(core.setSecret).toHaveBeenCalledTimes(1);
    expect(core.setSecret).toHaveBeenLastCalledWith(token);

    // Sets the output
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenLastCalledWith('token', token);

    // Saves the token for invalidation
    expect(core.saveState).toHaveBeenCalledTimes(1);
    expect(core.saveState).toHaveBeenLastCalledWith('token', token);
  });

  it('can export a git user with org token', async () => {
    const token = 'org-token';
    vi.mocked(core.getBooleanInput).mockReturnValue(true);
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'org':
          return 'electron';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForOrg).mockResolvedValue(token);
    vi.mocked(getAuthenticated).mockResolvedValue({ data: { slug } });
    vi.mocked(getByUsername).mockResolvedValue({
      data: {
        id: userId
      }
    });

    await index.run();
    expect(runSpy).toHaveReturned();

    // Exports git user environment variables
    expect(core.exportVariable).toHaveBeenCalledTimes(4);
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_AUTHOR_NAME',
      username
    );
    expect(core.exportVariable).toHaveBeenCalledWith('GIT_AUTHOR_EMAIL', email);
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_COMMITTER_NAME',
      username
    );
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GIT_COMMITTER_EMAIL',
      email
    );
  });

  it('handles token generate failure', async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'org':
          return 'electron';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForOrg).mockResolvedValue(null);

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenLastCalledWith('Could not generate token');
  });

  it('handles an unexpected error', async () => {
    const message = 'Server Error';
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'org':
          return 'electron';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForOrg).mockRejectedValue(new Error(message));

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenLastCalledWith(message);
  });

  it('narrows permissions on a repo token', async () => {
    const token = 'repo-token';
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'owner':
          return 'electron';
        case 'repo':
          return 'fake-repo';
        case 'permissions':
          return 'contents: read\nissues: write\n';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForRepo).mockResolvedValue(token);

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(getTokenForRepo).toHaveBeenLastCalledWith(
      { owner: 'electron', name: 'fake-repo' },
      expect.anything(),
      { permissions: { contents: 'read', issues: 'write' } }
    );
  });

  it('narrows permissions on an org token', async () => {
    const token = 'org-token';
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'org':
          return 'electron';
        case 'permissions':
          return 'contents: read';
        default:
          return '';
      }
    });
    vi.mocked(getTokenForOrg).mockResolvedValue(token);

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(getTokenForOrg).toHaveBeenLastCalledWith(
      'electron',
      expect.anything(),
      {
        permissions: { contents: 'read' }
      }
    );
  });

  it('rejects invalid permission levels', async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'org':
          return 'electron';
        case 'permissions':
          return 'contents: bogus';
        default:
          return '';
      }
    });

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenLastCalledWith(
      expect.stringContaining('Invalid permission level')
    );
    expect(getTokenForOrg).not.toHaveBeenCalled();
  });

  it('rejects non-mapping permissions input', async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case 'creds':
          return 'foobar';
        case 'org':
          return 'electron';
        case 'permissions':
          // A bare scalar parses to a string, which isn't a mapping.
          return 'just-a-scalar';
        default:
          return '';
      }
    });

    await index.run();
    expect(runSpy).toHaveReturned();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenLastCalledWith(
      expect.stringContaining('YAML mapping')
    );
    expect(getTokenForOrg).not.toHaveBeenCalled();
  });
});

describe('parsePermissionsInput', () => {
  it('returns undefined for empty input', () => {
    expect(index.parsePermissionsInput('')).toBeUndefined();
    expect(index.parsePermissionsInput('   \n  ')).toBeUndefined();
  });

  it('parses a single permission', () => {
    expect(index.parsePermissionsInput('contents: read')).toEqual({
      contents: 'read'
    });
  });

  it('parses multiple permissions across newlines', () => {
    expect(
      index.parsePermissionsInput('contents: read\nissues: write\n')
    ).toEqual({ contents: 'read', issues: 'write' });
  });

  it('ignores blank lines and YAML comments', () => {
    expect(
      index.parsePermissionsInput(
        '# leading comment\n\ncontents: read  # trailing\n'
      )
    ).toEqual({ contents: 'read' });
  });

  it('throws on invalid level', () => {
    expect(() => index.parsePermissionsInput('contents: oops')).toThrow(
      /Invalid permission level/
    );
  });

  it('throws when the document is not a mapping', () => {
    expect(() => index.parsePermissionsInput('just-a-scalar')).toThrow(
      /YAML mapping/
    );
    expect(() => index.parsePermissionsInput('- contents: read')).toThrow(
      /YAML mapping/
    );
  });

  it('throws on YAML syntax errors', () => {
    expect(() =>
      index.parsePermissionsInput('contents: read\n  bad: [')
    ).toThrow(/Could not parse permissions as YAML/);
  });
});
