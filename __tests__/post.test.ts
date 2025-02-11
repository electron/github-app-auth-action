import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as core from '@actions/core';
import * as github from '@actions/github';

import * as post from '../src/post';

const revokeInstallationAccessToken = vi.fn();

vi.mock('@actions/core');
vi.mock('@actions/github', () => {
  return {
    getOctokit: vi.fn(() => ({
      rest: {
        apps: {
          revokeInstallationAccessToken
        }
      }
    }))
  };
});

// Spy the action's post function
const postSpy = vi.spyOn(post, 'post');

describe('post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates the token', async () => {
    const token = 'gha_token';
    vi.mocked(core.getState).mockReturnValue(token);

    await post.post();
    expect(postSpy).toHaveReturned();

    expect(github.getOctokit).toHaveBeenCalledWith(token);
    expect(revokeInstallationAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does nothing if no token was generated', async () => {
    vi.mocked(core.getState).mockReturnValue('');

    await post.post();
    expect(postSpy).toHaveReturned();

    expect(github.getOctokit).not.toHaveBeenCalled();
  });

  it('handles any errors', async () => {
    const token = 'gha_token';
    const error = new Error('Invalid token');
    vi.mocked(core.getState).mockReturnValue(token);
    vi.mocked(revokeInstallationAccessToken).mockImplementation(() => {
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
