import * as core from '@actions/core';
import * as github from '@actions/github';

import * as post from '../src/post';

const revokeInstallationAccessToken = jest.fn();

jest.mock('@actions/core', () => {
  return {
    getInput: jest.fn(),
    getState: jest.fn(),
    info: jest.fn(),
    saveState: jest.fn(),
    setFailed: jest.fn(),
    setOutput: jest.fn(),
    setSecret: jest.fn(),
    warning: jest.fn()
  };
});
jest.mock('@actions/github', () => {
  return {
    getOctokit: jest.fn(() => ({
      rest: {
        apps: {
          revokeInstallationAccessToken
        }
      }
    }))
  };
});

// Spy the action's post function
const postSpy = jest.spyOn(post, 'post');

describe('post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates the token', async () => {
    const token = 'gha_token';
    jest.mocked(core.getState).mockReturnValue(token);

    await post.post();
    expect(postSpy).toHaveReturned();

    expect(github.getOctokit).toHaveBeenCalledWith(token);
    expect(revokeInstallationAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does nothing if no token was generated', async () => {
    jest.mocked(core.getState).mockReturnValue('');

    await post.post();
    expect(postSpy).toHaveReturned();

    expect(github.getOctokit).not.toHaveBeenCalled();
  });

  it('handles any errors', async () => {
    const token = 'gha_token';
    const error = new Error('Invalid token');
    jest.mocked(core.getState).mockReturnValue(token);
    jest.mocked(revokeInstallationAccessToken).mockImplementation(() => {
      throw error;
    });

    await post.post();
    expect(postSpy).toHaveReturned();

    expect(github.getOctokit).toHaveBeenCalledWith(token);
    expect(core.warning).toHaveBeenCalledWith(
      `Error while revoking token: ${error.message}`
    );
  });
});
