# polaris-headlamp-plugin

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/polaris-headlamp-plugin)](https://artifacthub.io/packages/headlamp/polaris-headlamp-plugin/polaris-headlamp-plugin)

A [Headlamp](https://headlamp.dev/) plugin that surfaces [Fairwinds Polaris](https://polaris.docs.fairwinds.com/) audit results directly in the Headlamp UI.

## What It Does

Adds a **Polaris** sidebar entry to Headlamp that displays:

- **Cluster Score** -- overall Polaris score as a percentage (color-coded green/amber/red)
- **Check Summary** -- total, pass, warning, and danger counts across all workloads
- **Cluster Info** -- node, pod, namespace, and controller counts

Data is read from the `ConfigMap/polaris-dashboard` in the `polaris` namespace (key: `dashboard.json`), which is created by the standard Polaris Helm chart. The plugin is read-only -- it never writes to the cluster.

Results are cached and refreshed on a user-configurable interval (1 / 5 / 10 / 30 minutes, default 5). The setting persists in the browser's localStorage.

Error states are handled explicitly: RBAC denied (403), Polaris not installed (404), malformed JSON, and loading.

## Prerequisites

- **Headlamp** >= v0.26 deployed in your cluster
- **Polaris** installed via the [official Helm chart](https://github.com/FairwindsOps/polaris) with the dashboard component enabled
- The Headlamp service account must have RBAC permission to `get` ConfigMaps in the `polaris` namespace

## Installing

### Option 1: Artifact Hub + Headlamp plugin manager (recommended)

The plugin is published on [Artifact Hub](https://artifacthub.io/packages/headlamp/polaris-headlamp-plugin/polaris-headlamp-plugin). Configure Headlamp's `pluginsManager` in your Helm values to install it automatically:

```yaml
pluginsManager:
  sources:
    - url: https://artifacthub.io/packages/headlamp/polaris-headlamp-plugin/polaris-headlamp-plugin
```

Headlamp will fetch and install the plugin on startup.

### Option 2: Docker init container

The plugin ships as a container image at `git.farh.net/farhoodliquor/polaris-headlamp-plugin`.

Add it as an init container in your Headlamp Helm values:

```yaml
initContainers:
  - name: polaris-plugin
    image: git.farh.net/farhoodliquor/polaris-headlamp-plugin:v0.0.1
    command: ["sh", "-c", "cp -r /plugins/* /headlamp/plugins/"]
    volumeMounts:
      - name: plugins
        mountPath: /headlamp/plugins

volumes:
  - name: plugins
    emptyDir: {}

volumeMounts:
  - name: plugins
    mountPath: /headlamp/plugins
```

### Option 3: Manual tarball install

Download the `.tar.gz` from the [GitHub releases page](https://github.com/cpfarhood/polaris-headlamp-plugin/releases) or the [Gitea releases page](https://git.farh.net/farhoodliquor/polaris-headlamp-plugin/releases), then extract into Headlamp's plugin directory:

```bash
tar xzf polaris-headlamp-plugin-0.0.1.tar.gz -C /headlamp/plugins/
```

### Option 4: Build from source

```bash
npm install
npm run build
npx @kinvolk/headlamp-plugin extract . /headlamp/plugins
```

## RBAC

The plugin reads a single ConfigMap. Minimum RBAC required for the Headlamp service account:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: headlamp-polaris-reader
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["polaris-dashboard"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: headlamp-polaris-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: headlamp-polaris-reader
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: headlamp
```

## Development

### Setup

```bash
git clone https://github.com/cpfarhood/polaris-headlamp-plugin.git
cd polaris-headlamp-plugin
npm install
```

### Run locally (hot reload)

```bash
npm start
```

This starts the Headlamp plugin dev server. Point a running Headlamp instance at the dev server to see changes live.

### Build for production

```bash
npm run build        # outputs dist/main.js
npm run package      # creates polaris-headlamp-plugin-<version>.tar.gz
```

### Type-check

```bash
npm run tsc
```

## Project Structure

```
src/
  index.tsx                  -- Entry point. Registers sidebar entry and route at /polaris.
  api/
    polaris.ts               -- TypeScript types matching the Polaris AuditData schema,
                                usePolarisData() hook with caching, countResults() utility,
                                and refresh interval settings (localStorage).
  components/
    PolarisView.tsx          -- Main page component. Score badge, check summary cards,
                                cluster info, error states, refresh interval selector.
```

## Data Source

The plugin reads from:

- **ConfigMap**: `polaris-dashboard`
- **Namespace**: `polaris`
- **Key**: `dashboard.json`

This ConfigMap is created automatically when Polaris is installed with the dashboard enabled. The JSON structure matches Polaris's `AuditData` schema (`pkg/validator/output.go`):

```
AuditData
  Score            -- cluster score (0-100)
  ClusterInfo      -- nodes, pods, namespaces, controllers
  Results[]        -- per-workload results
    Results{}      -- top-level check results (ResultSet)
    PodResult
      Results{}    -- pod-level check results
      ContainerResults[]
        Results{}  -- container-level check results
```

Each check in a `ResultSet` has `Success` (bool) and `Severity` (`"warning"` or `"danger"`).

## Releasing

Releases are automated via CI. To cut a release:

```bash
# Bump version in package.json and artifacthub-pkg.yml, then:
git add package.json package-lock.json artifacthub-pkg.yml
git commit -m "chore: bump version to 0.0.2"
git tag v0.0.2
git push origin main v0.0.2
```

This triggers two CI pipelines:

**Gitea Actions** (`.gitea/workflows/release.yaml`):
1. Build the plugin in a `node:20` container
2. Package a `.tar.gz` tarball
3. Build and push a Docker image to `git.farh.net/farhoodliquor/polaris-headlamp-plugin:{tag}` and `:latest`
4. Create a Gitea release with the tarball attached

**GitHub Actions** (`.github/workflows/release.yml`):
1. Build and package the plugin
2. Create a GitHub release with the tarball attached (required for Artifact Hub)

The Gitea repo push-mirrors to GitHub automatically, so both pipelines trigger from a single `git push`.

### CI secrets

| Secret | Where | Purpose |
|---|---|---|
| `REGISTRY_TOKEN` | Gitea | Personal access token with `package:write` scope for Docker image push |

The Gitea release uses the built-in `github.token`. The GitHub release uses the default `GITHUB_TOKEN` with `contents: write` permission.

### Updating Artifact Hub

When releasing a new version, update `artifacthub-pkg.yml`:
- `version` field
- `headlamp/plugin/archive-url` annotation (update the version in the download URL)
- `headlamp/plugin/archive-checksum` annotation (SHA256 of the new tarball, printed by the CI build)

## Links

- [Artifact Hub](https://artifacthub.io/packages/headlamp/polaris-headlamp-plugin/polaris-headlamp-plugin)
- [GitHub (mirror)](https://github.com/cpfarhood/polaris-headlamp-plugin)
- [Gitea (source of truth)](https://git.farh.net/farhoodliquor/polaris-headlamp-plugin)
- [Headlamp](https://headlamp.dev/)
- [Fairwinds Polaris](https://polaris.docs.fairwinds.com/)

## License

MIT
