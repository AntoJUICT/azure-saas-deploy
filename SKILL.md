---
name: azure-saas-deploy
description: Deploys a SaaS application to Azure using ARM templates and GitHub Actions. Generates infrastructure.json (shared resources, deploy once) and project.json (per-project deployment) for a Node.js/TypeScript + Next.js + PostgreSQL stack on Azure Container Apps. Use when deploying a new Azure SaaS project, adding a new project to shared infrastructure, or setting up GitHub Actions CI/CD for Azure Container Apps deployment.
---

# Azure SaaS Deploy

Shared infrastructure op Azure voor Node.js/Next.js SaaS projecten. Twee ARM templates, één GitHub Actions workflow.

## Stack
- **Frontend/Backend:** Next.js + Node.js (TypeScript) in één Container App
- **Database:** PostgreSQL Flexible Server (gedeeld, B1ms)
- **Storage:** Azure Storage Account (gedeeld, blob container per project)
- **Auth:** Entra ID multi-tenant + NextAuth.js + Microsoft Graph
- **DNS/SSL:** Cloudflare wildcard `*.<YOUR_DOMAIN>`
- **Registry:** Azure Container Registry

## Config laden

Alle infrastructuurwaarden worden opgeslagen in `~/.azure-saas-deploy/config.env`. Laad ze aan het begin van elke sessie:

```bash
source ~/.azure-saas-deploy/config.env
```

**Controleer altijd of de config geladen is voordat je een workflow uitvoert. Als het bestand niet bestaat, voer dan eerst Workflow 0 uit.**

---

## Workflow 0 — Eerste setup

Gebruik deze workflow de eerste keer, of als `~/.azure-saas-deploy/config.env` niet bestaat.

### Stap 1: Azure login verifiëren

```bash
az account show
```

Als niet ingelogd: `az login`

### Stap 2: Basis Azure-waarden ophalen

Haal automatisch op:

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Subscription: $SUBSCRIPTION_ID"
echo "Tenant:       $TENANT_ID"
```

**Vraag de gebruiker om te bevestigen of in te voeren:**

| Variabele | Beschrijving | Voorbeeld |
|-----------|--------------|-----------|
| `DOMAIN` | Domeinnaam voor subdomeinen | `example.com` |
| `RESOURCE_GROUP` | Resource group (nieuw of bestaand) | `myapp-shared-rg` |
| `LOCATION` | Azure regio | `westeurope` |
| `POSTGRES_ADMIN_LOGIN` | PostgreSQL admin gebruikersnaam | `pgadmin` |

### Stap 3: Resource group aanmaken (als nieuw)

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

### Stap 4: Unieke resource namen genereren of invoeren

Als er nog geen gedeelde resources bestaan, genereer unieke namen:

```bash
SUFFIX=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
ACR_NAME="myacr${SUFFIX}"
STORAGE_ACCOUNT="mystorage${SUFFIX}"
KEY_VAULT="myapp-kv-${SUFFIX}"
POSTGRES_SERVER="myapp-shared-pg"
CONTAINER_APPS_ENV="myapp-shared-env"
```

Toon de gegenereerde namen en vraag de gebruiker te bevestigen of aan te passen.

Als bestaande resources hergebruikt worden: vraag de gebruiker om de huidige namen op te geven.

### Stap 5: Config opslaan

```bash
mkdir -p ~/.azure-saas-deploy
cat > ~/.azure-saas-deploy/config.env << EOF
# Azure SaaS Deploy configuratie
# Aangemaakt: $(date)
SUBSCRIPTION_ID=${SUBSCRIPTION_ID}
TENANT_ID=${TENANT_ID}
RESOURCE_GROUP=${RESOURCE_GROUP}
LOCATION=${LOCATION}
DOMAIN=${DOMAIN}
POSTGRES_SERVER=${POSTGRES_SERVER}
POSTGRES_ADMIN_LOGIN=${POSTGRES_ADMIN_LOGIN}
CONTAINER_APPS_ENV=${CONTAINER_APPS_ENV}
ACR_NAME=${ACR_NAME}
ACR_LOGIN_SERVER=${ACR_NAME}.azurecr.io
STORAGE_ACCOUNT=${STORAGE_ACCOUNT}
KEY_VAULT=${KEY_VAULT}
EOF
echo "Config opgeslagen in ~/.azure-saas-deploy/config.env"
```

### Stap 6: Gedeelde infrastructuur uitrollen

Voer daarna **Workflow A** uit om alle Azure resources aan te maken.

---

## Gedeelde infrastructuur (uit config)

Na Workflow 0 zijn deze waarden beschikbaar via `~/.azure-saas-deploy/config.env`:

| Variable | Beschrijving |
|----------|--------------|
| `SUBSCRIPTION_ID` | Azure subscription ID |
| `TENANT_ID` | Azure tenant ID |
| `RESOURCE_GROUP` | Resource group naam |
| `LOCATION` | Azure regio |
| `DOMAIN` | Domeinnaam voor subdomeinen |
| `POSTGRES_SERVER` | PostgreSQL Flexible Server naam |
| `POSTGRES_ADMIN_LOGIN` | PostgreSQL admin gebruikersnaam |
| `CONTAINER_APPS_ENV` | Container Apps Environment naam |
| `ACR_NAME` | Azure Container Registry naam |
| `ACR_LOGIN_SERVER` | ACR login server (`<ACR_NAME>.azurecr.io`) |
| `STORAGE_ACCOUNT` | Storage account naam |
| `KEY_VAULT` | Key Vault naam |
| `POSTGRES_FQDN` | `<POSTGRES_SERVER>.postgres.database.azure.com` |
| `POSTGRES_PASSWORD` | In Key Vault — via `az keyvault secret show --vault-name $KEY_VAULT --name postgres-admin-password --query value -o tsv` |

---

## Workflows

### A — Gedeelde infrastructuur deployen

```bash
source ~/.azure-saas-deploy/config.env

# Postgres wachtwoord instellen (eenmalig) of ophalen
PG_PASSWORD=$(az keyvault secret show --vault-name $KEY_VAULT --name postgres-admin-password --query value -o tsv 2>/dev/null)
if [ -z "$PG_PASSWORD" ]; then
  PG_PASSWORD=$(openssl rand -base64 32)
  az keyvault create --name $KEY_VAULT --resource-group $RESOURCE_GROUP --location $LOCATION
  az keyvault secret set --vault-name $KEY_VAULT --name postgres-admin-password --value "$PG_PASSWORD"
fi

az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file templates/infrastructure.json \
  --parameters \
      containerAppsEnvironmentName=$CONTAINER_APPS_ENV \
      postgresServerName=$POSTGRES_SERVER \
      postgresAdminLogin=$POSTGRES_ADMIN_LOGIN \
      postgresAdminPassword="$PG_PASSWORD" \
      containerRegistryName=$ACR_NAME \
      storageAccountName=$STORAGE_ACCOUNT
```

Outputs opvragen na deployment:
```bash
az deployment group list --resource-group $RESOURCE_GROUP --query "[0].properties.outputs"
```

### B — Nieuw project toevoegen

**Vraag de gebruiker alleen:**
1. `PROJECT_NAME` — lowercase, geen spaties (bijv. `mijn-app`) → wordt subdomein `mijn-app.<DOMAIN>`
2. `ENTRA_CLIENT_ID` + `ENTRA_CLIENT_SECRET` — Entra ID app registration voor dit project (of gebruik een gedeelde registratie)

`AUTH_SECRET` wordt automatisch gegenereerd. Alle andere waarden komen uit de config.

```bash
source ~/.azure-saas-deploy/config.env

PG_PASSWORD=$(az keyvault secret show --vault-name $KEY_VAULT --name postgres-admin-password --query value -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
AUTH_SECRET=$(openssl rand -base64 32)

az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file templates/project.json \
  --parameters \
      projectName=$PROJECT_NAME \
      imageTag=latest \
      containerRegistryName=$ACR_NAME \
      containerRegistryPassword=$ACR_PASSWORD \
      postgresAdminPassword=$PG_PASSWORD \
      entraIdClientId=$ENTRA_CLIENT_ID \
      entraIdClientSecret=$ENTRA_CLIENT_SECRET \
      authSecret=$AUTH_SECRET
```

Na deployment: gebruik de `cloudflare-dns` skill om het subdomein automatisch aan te maken.

### Gedeelde API credentials (Key Vault + lokale shared.env)

Gedeelde credentials worden **nooit** als GitHub Secret of ARM parameter meegegeven:

| Omgeving | Locatie | Mechanisme |
|----------|---------|------------|
| Lokaal | `~/.azure-saas-deploy/shared.env` | Geladen door `next.config.ts` |
| Azure | Key Vault `$KEY_VAULT` | Container App Managed Identity |

De ARM template (`project.json`) kent automatisch Key Vault leesrechten toe aan elke nieuwe Container App. Geen handmatige stap nodig per project.

> ⚠️ **Key Vault references werken NIET betrouwbaar bij eerste deployment.** De managed identity access policy wordt in dezelfde ARM deployment aangemaakt, maar de Container App probeert secrets al op te halen vóórdat de policy actief is. **Oplossing:** geef project-specifieke secrets als directe ARM parameters (via GitHub Secrets), gebruik Key Vault references alleen voor al bestaande gedeelde credentials.

> ⚠️ **Container App secret namen: max 20 tekens.** Gebruik korte namen: `at-intg-code`, `dyn-secret`, etc.

> ⚠️ **Secrets met speciale tekens (`$`, `*`, `#`) in GitHub Actions:** NOOIT ophalen via `echo "VAR=$(az keyvault ...)" >> $GITHUB_ENV`. Sla op als GitHub Secret via `gh secret set` en refereer als `${{ secrets.NAAM }}`.

**Nieuw gedeeld secret toevoegen:**
```bash
source ~/.azure-saas-deploy/config.env

az keyvault secret set --vault-name $KEY_VAULT --name NAAM-VAN-SECRET --value 'waarde'
echo "NAAM_VAN_SECRET=waarde" >> ~/.azure-saas-deploy/shared.env
# In project.json: voeg toe aan secrets[] met keyVaultUrl en aan env[] met secretRef
```

### C — GitHub Actions instellen

Genereer `.github/workflows/deploy.yml` op basis van [REFERENCE.md](REFERENCE.md#github-actions).

**Service principal aanmaken of resetten:**
```bash
source ~/.azure-saas-deploy/config.env

# Nieuw aanmaken
az ad sp create-for-rbac \
  --name "github-actions-deploy" \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
  --json-auth

# Of bestaande resetten
az ad app credential reset --id <SP_CLIENT_ID> --years 2 --append
```

GitHub Secrets die eenmalig per repo ingesteld worden:

| Secret | Waarde | Hoe verkrijgen |
|--------|--------|----------------|
| `AZURE_CREDENTIALS` | Service principal JSON | Zie boven |
| `ACR_LOGIN_SERVER` | `<ACR_NAME>.azurecr.io` | `az acr show --name $ACR_NAME --query loginServer -o tsv` |
| `ACR_USERNAME` | ACR admin username | `az acr credential show --name $ACR_NAME --query username -o tsv` |
| `ACR_PASSWORD` | ACR admin password | `az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv` |
| `RESOURCE_GROUP` | Resource group naam | Uit config |
| `KEY_VAULT` | Key Vault naam | Uit config |
| `ENTRA_CLIENT_ID` | App registration client ID | Per project — Azure portal |
| `ENTRA_CLIENT_SECRET` | App registration secret | Per project — Azure portal |
| `AUTH_SECRET` | Random string (32+ chars) | `openssl rand -base64 32` |

`POSTGRES_ADMIN_PASSWORD` en `DATABASE_URL` zijn **geen** GitHub Secrets — ze worden live uit Key Vault gehaald.

### D — Nieuw project initialiseren (boilerplate)

Scaffold een nieuwe Next.js app die klaar is voor deployment:

- `package.json` — Next.js, NextAuth, Prisma, Azure Blob Storage
- `next.config.ts` — met `output: 'standalone'`
- `tsconfig.json`
- `prisma/schema.prisma` — basis User + Account model voor NextAuth
- `src/app/layout.tsx` + `src/app/page.tsx`
- `src/app/api/auth/[...nextauth]/route.ts` — Azure AD multi-tenant
- `src/lib/auth.ts` — NextAuth config
- `src/lib/db.ts` — Prisma client
- `src/lib/storage.ts` — Azure Blob Storage client
- `.env.example`
- `.gitignore`

Na scaffolding: `npm install` en `npx prisma generate`.

## Bestandsstructuur output

```
project/
├── templates/
│   ├── infrastructure.json
│   └── project.json
├── .github/
│   └── workflows/
│       └── deploy.yml
└── Dockerfile
```

Zie [REFERENCE.md](REFERENCE.md) voor volledige templates.
