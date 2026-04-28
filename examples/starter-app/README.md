# Starter App

Boilerplate Next.js SaaS app klaar voor Azure deployment via de `azure-saas-deploy` skill.

## Stack

- Next.js 14 (App Router, standalone output)
- NextAuth v5 met Microsoft Entra ID
- Prisma ORM + PostgreSQL
- Azure Blob Storage
- Gedeelde Azure infrastructuur (Container Apps, ACR, Key Vault)

## Lokaal starten

```bash
cp .env.example .env.local
# Vul .env.local in met jouw waarden
npm install
npx prisma migrate dev
npm run dev
```

Gedeelde credentials (bijv. API keys) worden automatisch geladen uit `~/.azure-saas-deploy/shared.env`.

## Deployen naar Azure

Gebruik de `azure-saas-deploy` skill in Claude Code:

1. Zorg dat Workflow 0 (setup) is uitgevoerd
2. Pas `PROJECT_NAME` aan in `.github/workflows/deploy.yml`
3. Stel GitHub Secrets in (zie SKILL.md Workflow C)
4. Push naar `main` — GitHub Actions bouwt en deployt automatisch

## Aanpassen

Dit is een minimale boilerplate. Voeg toe wat jouw project nodig heeft:

- Extra Prisma modellen in `prisma/schema.prisma`
- API routes in `src/app/api/`
- UI componenten in `src/app/`
- Gedeelde secrets via `az keyvault secret set` + `project.json`
