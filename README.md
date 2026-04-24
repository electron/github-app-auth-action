# GitHub App Auth Action

[![GitHub Super-Linter](https://github.com/electron/github-app-auth-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
[![CI](https://github.com/electron/github-app-auth-action/actions/workflows/ci.yml/badge.svg)](https://github.com/electron/github-app-auth-action/actions/workflows/ci.yml)

> GitHub Action which gets an auth token for a repo or organization via a GitHub
> app installation

## Usage

A credential bundle should be generated for the GitHub app [using these
instructions][generating-cred-bundle] and provided as the `creds` input.

- To generate an org-scoped token, provide only the `org` input
- To generate a repo-scoped token, provide `owner` and `repo` inputs

> [!NOTE]
>
> By default the `owner` and `repo` inputs refer to the current repository, so
> they do not need to be provided unless the token is needed for a different
> repository.

The minted token carries the App installation's full set of permissions unless
you narrow it via the optional `permissions` input (see
[Narrowing token permissions](#narrowing-token-permissions)).

### Example

```yaml
jobs:
  issue-commented:
    name: Remove label on comment
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        uses: electron/github-app-auth-action@v1.1.1
        id: generate-token
        with:
          creds: ${{ secrets.GH_APP_CREDS }}
      - name: Remove label
        env:
          GITHUB_TOKEN: ${{ steps.generate-token.outputs.token }}
          ISSUE_URL: ${{ github.event.issue.html_url }}
        run: |
          gh issue edit $ISSUE_URL --remove-label 'blocked/need-repro'
```

### Inputs

- `creds` - **(required)** A credential bundle for the GitHub app to generate
  the token for
- `org` - _(optional)_ The organization for an org-scoped token
- `owner` - _(optional)_ The repository owner for a repo-scoped token
- `repo` - _(optional)_ The repository name for a repo-scoped token
- `export-git-user` - _(optional)_ [Export environment
  variables][git-env-variables] which set the Git user to the GitHub app user
- `permissions` - _(optional)_ YAML mapping used to narrow the minted
  installation token to a subset of the App's permissions (see
  [Narrowing token permissions](#narrowing-token-permissions))

### Outputs

- `token` - GitHub App installation access token

### Narrowing token permissions

By default, the action mints an installation token with every permission the App
installation has been granted. The `permissions` input accepts a YAML mapping of
`<permission>: <level>` entries (same shape GitHub uses in workflow
`permissions:` blocks) and forwards them to the
[`POST /app/installations/{id}/access_tokens`][create-access-token] endpoint so
the minted token only carries the requested subset.

Each level must be one of `read`, `write`, or `admin`. Permissions listed here
must be a subset of the App's installation permissions — you cannot escalate
beyond what the App itself was granted. Omitting the input (or leaving it empty)
preserves the previous behavior of minting a full-scope token.

This is useful for privilege-splitting a workflow across phases: mint a
read-only token for a checkout or scan step, revoke it, and only mint a
write-scoped token immediately before a push.

```yaml
jobs:
  roll:
    runs-on: ubuntu-latest
    steps:
      - name: Mint read-only token for checkout
        id: read-token
        uses: electron/github-app-auth-action@v2
        with:
          creds: ${{ secrets.GH_APP_CREDS }}
          owner: my-org
          repo: my-repo
          permissions: |
            contents: read

      - uses: actions/checkout@v6
        with:
          repository: my-org/my-repo
          token: ${{ steps.read-token.outputs.token }}

      # ... do work that does not need write access ...

      - name: Mint write-scoped token for push
        id: write-token
        uses: electron/github-app-auth-action@v2
        with:
          creds: ${{ secrets.GH_APP_CREDS }}
          owner: my-org
          repo: my-repo
          permissions: |
            contents: write

      - name: Push
        env:
          GITHUB_TOKEN: ${{ steps.write-token.outputs.token }}
        run: |
          git push \
            "https://x-access-token:${GITHUB_TOKEN}@github.com/my-org/my-repo.git" \
            HEAD:refs/heads/some-branch
```

Refer to the [GitHub REST API permission reference][permissions-reference] for
the full list of permission names and levels.

## License

MIT

[generating-cred-bundle]:
  https://github.com/electron/github-app-auth#generating-credentials
[git-env-variables]:
  https://git-scm.com/book/en/v2/Git-Internals-Environment-Variables
[create-access-token]:
  https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app
[permissions-reference]:
  https://docs.github.com/en/rest/overview/permissions-required-for-github-apps
