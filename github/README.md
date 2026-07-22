# GitHub — Grupo Falpat SRL

## Estructura del repositorio

```
.github/
  workflows/
    deploy.yml          # CI/CD automatico a Vercel
  ISSUE_TEMPLATE/
    bug_report.md
    feature_request.md
```

## Configuracion necesaria

### Secrets del repositorio (Settings > Secrets and variables > Actions)
| Secret | Descripcion | Ejemplo |
|--------|-------------|---------|
| `VERCEL_TOKEN` | Token de deploy de Vercel | `vercel-token-xxxxx` |
| `VERCEL_ORG_ID` | ID de la organizacion Vercel | `team_xxxxx` |
| `VERCEL_PROJECT_ID` | ID del proyecto Vercel | `prj_xxxxx` |

### Variables del repositorio
| Variable | Descripcion |
|----------|-------------|
| `NODE_VERSION` | Version de Node.js (default: 22) |

## Comandos utiles
```bash
# Clonar
git clone https://github.com/USUARIO/herramientas.git

# Deploy manual
vercel --prod

# Ver historial de deploys
vercel ls
```

## Branches
- `main` → deploy automatico a produccion
- `develop` → deploy a preview
