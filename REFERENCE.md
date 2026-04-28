# Azure SaaS Deploy — Reference Templates

> Alle waarden met `$VAR` komen uit `~/.azure-saas-deploy/config.env`. Laad deze via `source ~/.azure-saas-deploy/config.env` voordat je een commando uitvoert.

## infrastructure-template

`templates/infrastructure.json` — eenmalig deployen voor gedeelde resources.

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]"
    },
    "containerAppsEnvironmentName": {
      "type": "string"
    },
    "postgresServerName": {
      "type": "string"
    },
    "postgresAdminLogin": {
      "type": "string",
      "defaultValue": "pgadmin"
    },
    "postgresAdminPassword": {
      "type": "securestring"
    },
    "containerRegistryName": {
      "type": "string"
    },
    "storageAccountName": {
      "type": "string"
    }
  },
  "variables": {
    "logAnalyticsName": "[concat(parameters('containerAppsEnvironmentName'), '-logs')]"
  },
  "resources": [
    {
      "type": "Microsoft.OperationalInsights/workspaces",
      "apiVersion": "2022-10-01",
      "name": "[variables('logAnalyticsName')]",
      "location": "[parameters('location')]",
      "properties": {
        "sku": { "name": "PerGB2018" },
        "retentionInDays": 30
      }
    },
    {
      "type": "Microsoft.App/managedEnvironments",
      "apiVersion": "2023-05-01",
      "name": "[parameters('containerAppsEnvironmentName')]",
      "location": "[parameters('location')]",
      "dependsOn": [
        "[resourceId('Microsoft.OperationalInsights/workspaces', variables('logAnalyticsName'))]"
      ],
      "properties": {
        "appLogsConfiguration": {
          "destination": "log-analytics",
          "logAnalyticsConfiguration": {
            "customerId": "[reference(resourceId('Microsoft.OperationalInsights/workspaces', variables('logAnalyticsName'))).customerId]",
            "sharedKey": "[listKeys(resourceId('Microsoft.OperationalInsights/workspaces', variables('logAnalyticsName')), '2022-10-01').primarySharedKey]"
          }
        }
      }
    },
    {
      "type": "Microsoft.DBforPostgreSQL/flexibleServers",
      "apiVersion": "2023-06-01-preview",
      "name": "[parameters('postgresServerName')]",
      "location": "[parameters('location')]",
      "sku": {
        "name": "Standard_B1ms",
        "tier": "Burstable"
      },
      "properties": {
        "administratorLogin": "[parameters('postgresAdminLogin')]",
        "administratorLoginPassword": "[parameters('postgresAdminPassword')]",
        "version": "15",
        "storage": { "storageSizeGB": 32 },
        "backup": {
          "backupRetentionDays": 7,
          "geoRedundantBackup": "Disabled"
        },
        "highAvailability": { "mode": "Disabled" }
      }
    },
    {
      "type": "Microsoft.DBforPostgreSQL/flexibleServers/firewallRules",
      "apiVersion": "2023-06-01-preview",
      "name": "[concat(parameters('postgresServerName'), '/AllowAzureServices')]",
      "dependsOn": [
        "[resourceId('Microsoft.DBforPostgreSQL/flexibleServers', parameters('postgresServerName'))]"
      ],
      "properties": {
        "startIpAddress": "0.0.0.0",
        "endIpAddress": "0.0.0.0"
      }
    },
    {
      "type": "Microsoft.ContainerRegistry/registries",
      "apiVersion": "2023-07-01",
      "name": "[parameters('containerRegistryName')]",
      "location": "[parameters('location')]",
      "sku": { "name": "Basic" },
      "properties": {
        "adminUserEnabled": true
      }
    },
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-01-01",
      "name": "[parameters('storageAccountName')]",
      "location": "[parameters('location')]",
      "sku": { "name": "Standard_LRS" },
      "kind": "StorageV2",
      "properties": {
        "accessTier": "Hot",
        "supportsHttpsTrafficOnly": true,
        "minimumTlsVersion": "TLS1_2"
      }
    }
  ],
  "outputs": {
    "containerAppsEnvironmentId": {
      "type": "string",
      "value": "[resourceId('Microsoft.App/managedEnvironments', parameters('containerAppsEnvironmentName'))]"
    },
    "postgresServerFqdn": {
      "type": "string",
      "value": "[reference(resourceId('Microsoft.DBforPostgreSQL/flexibleServers', parameters('postgresServerName'))).fullyQualifiedDomainName]"
    },
    "containerRegistryLoginServer": {
      "type": "string",
      "value": "[reference(resourceId('Microsoft.ContainerRegistry/registries', parameters('containerRegistryName'))).loginServer]"
    }
  }
}
```

---

## project-template

`templates/project.json` — per nieuw project deployen.

Gedeelde API-credentials komen **niet** als parameters — die worden opgehaald uit Key Vault via Managed Identity. Zie SKILL.md "Gedeelde API credentials".

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]"
    },
    "projectName": {
      "type": "string",
      "metadata": { "description": "Lowercase naam, geen spaties. Wordt gebruikt als subdomein." }
    },
    "imageTag": {
      "type": "string",
      "defaultValue": "latest"
    },
    "containerRegistryName": {
      "type": "string"
    },
    "containerRegistryPassword": {
      "type": "securestring"
    },
    "containerAppsEnvironmentName": {
      "type": "string"
    },
    "postgresServerName": {
      "type": "string"
    },
    "postgresAdminLogin": {
      "type": "string",
      "defaultValue": "pgadmin"
    },
    "postgresAdminPassword": {
      "type": "securestring"
    },
    "storageAccountName": {
      "type": "string"
    },
    "keyVaultName": {
      "type": "string",
      "metadata": { "description": "Gedeelde Key Vault met gedeelde API credentials." }
    },
    "entraIdClientId": {
      "type": "string"
    },
    "entraIdClientSecret": {
      "type": "securestring"
    },
    "authSecret": {
      "type": "securestring"
    },
    "domain": {
      "type": "string",
      "metadata": { "description": "Domeinnaam voor subdomeinen, bijv. example.com" }
    }
  },
  "variables": {
    "containerAppName": "[parameters('projectName')]",
    "databaseName": "[replace(parameters('projectName'), '-', '_')]",
    "blobContainerName": "[concat(parameters('projectName'), '-files')]",
    "acrLoginServer": "[concat(parameters('containerRegistryName'), '.azurecr.io')]",
    "imageName": "[concat(parameters('containerRegistryName'), '.azurecr.io/', parameters('projectName'), ':', parameters('imageTag'))]",
    "databaseUrl": "[concat('postgresql://', parameters('postgresAdminLogin'), ':', parameters('postgresAdminPassword'), '@', parameters('postgresServerName'), '.postgres.database.azure.com/', variables('databaseName'), '?sslmode=require')]",
    "keyVaultBaseUrl": "[concat('https://', parameters('keyVaultName'), '.vault.azure.net/secrets/')]"
  },
  "resources": [
    {
      "type": "Microsoft.DBforPostgreSQL/flexibleServers/databases",
      "apiVersion": "2023-06-01-preview",
      "name": "[concat(parameters('postgresServerName'), '/', variables('databaseName'))]",
      "properties": {
        "charset": "UTF8",
        "collation": "en_US.utf8"
      }
    },
    {
      "type": "Microsoft.Storage/storageAccounts/blobServices/containers",
      "apiVersion": "2023-01-01",
      "name": "[concat(parameters('storageAccountName'), '/default/', variables('blobContainerName'))]",
      "properties": {
        "publicAccess": "None"
      }
    },
    {
      "type": "Microsoft.App/containerApps",
      "apiVersion": "2023-05-01",
      "name": "[variables('containerAppName')]",
      "location": "[parameters('location')]",
      "identity": {
        "type": "SystemAssigned"
      },
      "dependsOn": [
        "[resourceId('Microsoft.DBforPostgreSQL/flexibleServers/databases', parameters('postgresServerName'), variables('databaseName'))]"
      ],
      "properties": {
        "managedEnvironmentId": "[resourceId('Microsoft.App/managedEnvironments', parameters('containerAppsEnvironmentName'))]",
        "configuration": {
          "activeRevisionsMode": "Single",
          "ingress": {
            "external": true,
            "targetPort": 3000,
            "transport": "http"
          },
          "registries": [
            {
              "server": "[variables('acrLoginServer')]",
              "username": "[parameters('containerRegistryName')]",
              "passwordSecretRef": "acr-password"
            }
          ],
          "secrets": [
            { "name": "acr-password",       "value": "[parameters('containerRegistryPassword')]" },
            { "name": "database-url",        "value": "[variables('databaseUrl')]" },
            { "name": "auth-secret",         "value": "[parameters('authSecret')]" },
            { "name": "entra-client-secret", "value": "[parameters('entraIdClientSecret')]" },
            {
              "name": "shared-secret-1",
              "keyVaultUrl": "[concat(variables('keyVaultBaseUrl'), 'NAAM-VAN-SECRET')]",
              "identity": "system"
            }
          ]
        },
        "template": {
          "containers": [
            {
              "name": "[variables('containerAppName')]",
              "image": "[variables('imageName')]",
              "resources": {
                "cpu": 0.5,
                "memory": "1Gi"
              },
              "env": [
                { "name": "NODE_ENV",                          "value": "production" },
                { "name": "DATABASE_URL",                      "secretRef": "database-url" },
                { "name": "AUTH_URL",                          "value": "[concat('https://', parameters('projectName'), '.', parameters('domain'))]" },
                { "name": "AUTH_SECRET",                       "secretRef": "auth-secret" },
                { "name": "AUTH_MICROSOFT_ENTRA_ID_ID",        "value": "[parameters('entraIdClientId')]" },
                { "name": "AUTH_MICROSOFT_ENTRA_ID_SECRET",    "secretRef": "entra-client-secret" },
                { "name": "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID", "value": "organizations" },
                { "name": "GEDEELDE_VAR",                      "secretRef": "shared-secret-1" }
              ]
            }
          ],
          "scale": {
            "minReplicas": 1,
            "maxReplicas": 3,
            "rules": [
              {
                "name": "http-scaling",
                "http": { "metadata": { "concurrentRequests": "10" } }
              }
            ]
          }
        }
      }
    },
    {
      "type": "Microsoft.KeyVault/vaults/accessPolicies",
      "apiVersion": "2023-07-01",
      "name": "[concat(parameters('keyVaultName'), '/add')]",
      "dependsOn": [
        "[resourceId('Microsoft.App/containerApps', variables('containerAppName'))]"
      ],
      "properties": {
        "accessPolicies": [
          {
            "tenantId": "[subscription().tenantId]",
            "objectId": "[reference(resourceId('Microsoft.App/containerApps', variables('containerAppName')), '2023-05-01', 'Full').identity.principalId]",
            "permissions": {
              "secrets": ["get", "list"]
            }
          }
        ]
      }
    }
  ],
  "outputs": {
    "containerAppFqdn": {
      "type": "string",
      "value": "[reference(resourceId('Microsoft.App/containerApps', variables('containerAppName'))).configuration.ingress.fqdn]"
    },
    "projectUrl": {
      "type": "string",
      "value": "[concat('https://', parameters('projectName'), '.', parameters('domain'))]"
    }
  }
}
```

---

## github-actions

`.github/workflows/deploy.yml`

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

env:
  PROJECT_NAME: mijn-app   # Pas aan per project

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to Azure
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login to Azure Container Registry
        uses: azure/docker-login@v2
        with:
          login-server: ${{ secrets.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Fetch postgres password from Key Vault
        id: kv
        run: |
          PG_PASS=$(az keyvault secret show --vault-name ${{ secrets.KEY_VAULT }} --name postgres-admin-password --query value -o tsv)
          echo "pg_pass=${PG_PASS}" >> $GITHUB_OUTPUT

      - name: Build & Push Docker image
        run: |
          docker build \
            -t ${{ secrets.ACR_LOGIN_SERVER }}/${{ env.PROJECT_NAME }}:${{ github.sha }} \
            -t ${{ secrets.ACR_LOGIN_SERVER }}/${{ env.PROJECT_NAME }}:latest \
            .
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/${{ env.PROJECT_NAME }}:${{ github.sha }}
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/${{ env.PROJECT_NAME }}:latest

      - name: Deploy ARM project template
        uses: azure/arm-deploy@v2
        with:
          resourceGroupName: ${{ secrets.RESOURCE_GROUP }}
          template: ./templates/project.json
          parameters: >
            projectName=${{ env.PROJECT_NAME }}
            domain=${{ secrets.DOMAIN }}
            imageTag=${{ github.sha }}
            containerRegistryName=${{ secrets.ACR_USERNAME }}
            containerRegistryPassword=${{ secrets.ACR_PASSWORD }}
            containerAppsEnvironmentName=${{ secrets.CONTAINER_APPS_ENV }}
            postgresServerName=${{ secrets.POSTGRES_SERVER }}
            postgresAdminPassword=${{ steps.kv.outputs.pg_pass }}
            keyVaultName=${{ secrets.KEY_VAULT }}
            storageAccountName=${{ secrets.STORAGE_ACCOUNT }}
            entraIdClientId=${{ secrets.ENTRA_CLIENT_ID }}
            entraIdClientSecret=${{ secrets.ENTRA_CLIENT_SECRET }}
            authSecret=${{ secrets.AUTH_SECRET }}
      # Migrations worden uitgevoerd door de container zelf bij startup (zie Dockerfile CMD)
      # PostgreSQL firewall staat alleen Azure services toe — GitHub runners hebben geen toegang
```

> ⚠️ **Secrets met speciale tekens** in bash: gebruik `$GITHUB_OUTPUT` (via `echo "key=val" >> $GITHUB_OUTPUT`) i.p.v. `$GITHUB_ENV` — dit voorkomt shell interpolatie.

### Vereiste GitHub Secrets

| Secret | Beschrijving | Hoe verkrijgen |
|--------|--------------|----------------|
| `AZURE_CREDENTIALS` | Service principal JSON | Zie SKILL.md Workflow C |
| `ACR_LOGIN_SERVER` | ACR login server URL | `az acr show --name $ACR_NAME --query loginServer -o tsv` |
| `ACR_USERNAME` | ACR admin username | `az acr credential show --name $ACR_NAME --query username -o tsv` |
| `ACR_PASSWORD` | ACR admin password | `az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv` |
| `RESOURCE_GROUP` | Resource group naam | Uit config |
| `KEY_VAULT` | Key Vault naam | Uit config |
| `DOMAIN` | Domeinnaam voor subdomeinen | Uit config |
| `CONTAINER_APPS_ENV` | Container Apps Environment naam | Uit config |
| `POSTGRES_SERVER` | PostgreSQL server naam | Uit config |
| `STORAGE_ACCOUNT` | Storage account naam | Uit config |
| `ENTRA_CLIENT_ID` | App registration client ID | Per project — Azure portal |
| `ENTRA_CLIENT_SECRET` | App registration secret | Per project — Azure portal |
| `AUTH_SECRET` | Random string (32+ chars) | `openssl rand -base64 32` |

**Niet nodig als GitHub Secret:** `POSTGRES_ADMIN_PASSWORD`, `DATABASE_URL` — worden live uit Key Vault gehaald.

---

## cloudflare-dns

### Subdomein instellen voor `<PROJECT_NAME>.<YOUR_DOMAIN>`

Na elke project deployment:

1. Haal de Azure Container App FQDN op:
   ```bash
   source ~/.azure-saas-deploy/config.env
   az containerapp show \
     --name $PROJECT_NAME \
     --resource-group $RESOURCE_GROUP \
     --query "properties.configuration.ingress.fqdn" \
     --output tsv
   ```
   Output voorbeeld: `mijn-app.wonderfulrock-abc123.westeurope.azurecontainerapps.io`

2. Voeg in Cloudflare DNS toe:

   | Type | Name | Content | Proxy |
   |------|------|---------|-------|
   | CNAME | `mijn-app` | `mijn-app.wonderfulrock-abc123.westeurope.azurecontainerapps.io` | Proxied |

3. Cloudflare handelt SSL automatisch af.

---

## entra-id-setup

### Multi-tenant App Registration aanmaken

```bash
az ad app create \
  --display-name "mijn-app" \
  --sign-in-audience AzureADandPersonalMicrosoftAccount \
  --web-redirect-uris "https://mijn-app.<YOUR_DOMAIN>/api/auth/callback/azure-ad"

az ad app credential reset \
  --id $APP_CLIENT_ID \
  --append
```

### NextAuth.js configuratie

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"

export const { handlers, auth } = NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: "common", // multi-tenant
    }),
  ],
})
```

---

## prisma-schema-generator

Altijd `binaryTargets` instellen voor Alpine (node:20-alpine):

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

Zonder dit genereert Prisma alleen de `linux-musl` binary en crasht de container met "Could not locate the Query Engine".

---

## dockerfile

Standaard Dockerfile voor Next.js + Node.js:

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
```

> Vereist `output: 'standalone'` in `next.config.js`.
