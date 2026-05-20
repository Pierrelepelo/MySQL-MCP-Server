# Installation Globale du MySQL MCP Server

Ce guide explique comment utiliser le MySQL MCP Server dans n'importe quel projet sur votre machine.

## Option 1: Utilisation via le dépôt local (Recommandé)

Le serveur MCP est déjà configuré pour le projet DEPSE dans `.mcp.json`. Pour l'utiliser dans d'autres projets:

### Méthode A: Créer un lien symbolique

```bash
# Créer un lien symbolique vers le serveur MCP
mklink /D "C:\wamp64\www\depse2019\.mcp.json" "%USERPROFILE%\.claude\mcp.json"
```

### Méthode B: Ajouter la configuration à chaque projet

Ajoutez ce contenu au fichier `.mcp.json` à la racine de chaque projet:

```json
{
  "mcpServers": {
    "mysql-depse": {
      "command": "node",
      "args": ["C:\\wamp64\\www\\depse2019\\dist\\index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "",
        "MYSQL_DATABASE": "depse2019",
        "MYSQL_PROFILE": "balanced"
      }
    }
  }
}
```

## Option 2: Installation Globale via npm (Futur)

Pour rendre le MCP disponible globalement:

```bash
cd C:\wamp64\www\depse2019
npm link
```

Puis dans chaque projet, ajoutez au `.mcp.json`:

```json
{
  "mcpServers": {
    "mysql-depse": {
      "command": "mysql-mcp-server",
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "",
        "MYSQL_DATABASE": "depse2019",
        "MYSQL_PROFILE": "balanced"
      }
    }
  }
}
```

## Vérification

Pour vérifier que le MCP est accessible:

1. Ouvrez Claude Code
2. Ouvrez n'importe quel projet
3. Tapez: "Liste les bases de données" ou "Liste les tables de depse2019"

Le MCP devrait répondre avec les informations de votre base de données.

## Outils Disponibles

**Discovery Tools:**
- `list_databases` - Lister les bases de données accessibles
- `list_tables` - Lister les tables avec nombres de lignes
- `describe_table` - Schéma détaillé d'une table
- `search_schema` - Rechercher tables/colonnes par motif
- `get_table_sample` - Échantillon de lignes d'une table
- `get_table_stats` - Statistiques d'une table
- `refresh_schema_cache` - Rafraîchir le cache de schéma

**Execution Tools:**
- `validate_query` - Valider sans exécuter
- `execute_select` - Exécuter SELECT avec protections

## Exemples d'Utilisation

```
# Dans Claude Code, avec n'importe quel projet ouvert:

"Montre-moi toutes les tables de la base depse2019"
→ Appelle list_tables

"Trouve les tables qui contiennent 'naissance'"
→ Appelle search_schema("naissance")

"Quelle est la structure de la table depse_log_localite ?"
→ Appelle describe_table("depse_log_localite")

"Exécute: SELECT COUNT(*) FROM depse_log_localite WHERE valide = 1"
→ Valide et exécute la requête
```
