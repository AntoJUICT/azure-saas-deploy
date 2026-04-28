# azure-saas-deploy

A Claude Code skill for deploying SaaS applications to Azure using ARM templates and GitHub Actions.

## What it does

- Deploys shared Azure infrastructure once (PostgreSQL, Container Registry, Container Apps Environment, Storage, Key Vault)
- Adds new projects to the shared infrastructure with a single command
- Sets up GitHub Actions CI/CD for Azure Container Apps
- Scaffolds new Next.js projects ready for deployment

## Stack

- **Frontend/Backend:** Next.js + Node.js (TypeScript) in one Container App
- **Database:** PostgreSQL Flexible Server (shared, B1ms)
- **Auth:** Entra ID multi-tenant + NextAuth.js
- **DNS/SSL:** Cloudflare wildcard subdomain
- **Registry:** Azure Container Registry

## Installation

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "skills": [
    {
      "name": "azure-saas-deploy",
      "path": "path/to/azure-saas-deploy-skill"
    }
  ]
}
```

Or install as a plugin via the Claude Code CLI.

## First-time setup

On first use, the skill runs **Workflow 0** which:

1. Verifies your Azure login (`az login`)
2. Asks for your domain name, resource group, and location
3. Generates unique resource names (or lets you provide existing ones)
4. Saves all configuration to `~/.azure-saas-deploy/config.env`
5. Deploys the shared Azure infrastructure

All subsequent workflows load values from this config file — no hardcoded values anywhere.

## Workflows

| Workflow | When to use |
|----------|-------------|
| **0 — Setup** | First time, or when config is missing |
| **A — Infrastructure** | Deploy shared Azure resources (once) |
| **B — New project** | Add a new project to the shared infrastructure |
| **C — GitHub Actions** | Set up CI/CD for a project repo |
| **D — Boilerplate** | Scaffold a new Next.js project |

## Requirements

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`)
- [GitHub CLI](https://cli.github.com/) (`gh`) — for setting GitHub Secrets
- An Azure subscription
- A Cloudflare-managed domain (for DNS/SSL)

## License

MIT
