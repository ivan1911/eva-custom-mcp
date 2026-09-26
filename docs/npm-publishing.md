# Publishing to npm

The `Publish npm` workflow is manual and publishes only from `main`.
It checks the requested version, runs typecheck, tests and build, inspects
the package with a dry run, then publishes using npm Trusted Publishing.
No npm token or EvaTeam credentials are needed in GitHub Secrets.

## One-time setup

After `.github/workflows/publish.yml` is merged into `main`, open the
`eva-custom-mcp` package settings on npmjs.com and add a GitHub Actions
Trusted Publisher with these exact values:

- Organization or user: `ivan1911`
- Repository: `eva-custom-mcp`
- Workflow filename: `publish.yml` (not the full path)
- Environment: leave empty (the workflow does not use an environment)
- Allowed actions: enable direct publishing with `npm publish`

See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

## Release a version

1. Update `package.json` and `package-lock.json`, for example with
   `npm version 0.1.5 --no-git-tag-version`.
2. Commit the version change and merge the reviewed PR into `main`.
3. Run the workflow from GitHub Actions, selecting `main` and entering the
   exact committed version, or use:

   ```sh
   gh workflow run publish.yml --ref main -f version=0.1.5
   gh run list --workflow publish.yml
   gh run watch <run-id>
   ```

The workflow does not bump versions, create tags, or merge PRs. A version
already published to npm cannot be overwritten; prepare a new version.
Selecting another branch skips the publish job. Ordinary pushes and PRs
never trigger publishing. Do not add a long-lived npm token as a fallback
if trust configuration is missing; correct the Trusted Publisher settings.
