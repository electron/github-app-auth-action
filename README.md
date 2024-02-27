# GitHub App Auth Action

[![GitHub Super-Linter](https://github.com/electron/github-app-auth-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
[![CI](https://github.com/electron/github-app-auth-action/actions/workflows/ci.yml/badge.svg)](https://github.com/electron/github-app-auth-action/actions/workflows/ci.yml)

> GitHub Action which gets an auth token for a repo or organization via a
> GitHub app installation

## Usage

A credential bundle should be generated for the GitHub app
[using these instructions][generating-cred-bundle] and provided as the `creds`
input.

- To generate an org-scoped token, provide only the `org` input
- To generate a repo-scoped token, provide `owner` and `repo` inputs

> [!NOTE]
> By default the `owner` and `repo` inputs refer to the current repository, so
> they do not need to be provided unless the token is needed for a different
> repository.

### Example

```yaml
jobs:
  issue-commented:
    name: Remove label on comment
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        uses: electron/github-app-auth-action@main
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
- `org` - *(optional)* The organization for an org-scoped token
- `owner` - *(optional)* The repository owner for a repo-scoped token
- `repo` - *(optional)* The repository name for a repo-scoped token
- `export-git-user` - *(optional)* [Export environment variables][git-env-variables]
  which set the git user to the GitHub app user

### Outputs

- `token` - GitHub App installation access token

## License

MIT

[generating-cred-bundle]: https://github.com/electron/github-app-auth#generating-credentials
[git-env-variables]: https://git-scm.com/book/en/v2/Git-Internals-Environment-Variables
