# @digimmo/back

API NestJS de Digimmo : PostgreSQL (TypeORM, migrations versionnées) pour les comptes, projets et catalogue de meubles ; MongoDB (Mongoose) pour les documents de plan.

## Démarrage

```bash
docker compose up -d        # PostgreSQL, MongoDB, Mailpit
cp .env.example .env
npm run migration:run -w @digimmo/back
npm run seed -w @digimmo/back
npm run start:dev -w @digimmo/back
```

> `docker/postgres-init.sql` (création de la base `digimmo_test`) ne s'exécute que sur un volume neuf.
> Pour le rejouer : `docker compose down -v` puis `docker compose up -d` (efface les données locales).

## Migrations

`synchronize` est désactivé partout : le schéma n'évolue que par migrations (`src/database/migrations`). Les scripts compilent d'abord (`nest build`) puis utilisent le CLI TypeORM sur `dist/database/data-source.js` ; ils lisent `../../.env`.

```bash
# générer une migration à partir des différences entités / base
npm run migration:generate -w @digimmo/back -- src/database/migrations/<nom>
npm run migration:run -w @digimmo/back      # appliquer
npm run migration:revert -w @digimmo/back   # annuler la dernière
```

Relire systématiquement le SQL généré avant de le committer. Les tests e2e appliquent les migrations automatiquement sur `digimmo_test`.

## Seed et premier administrateur

```bash
# catalogue de meubles seulement
npm run seed -w @digimmo/back

# catalogue + premier administrateur
ADMIN_EMAIL=moi@exemple.fr ADMIN_PASSWORD='un-mot-de-passe-solide' npm run seed -w @digimmo/back
```

Le seed est idempotent : il applique les migrations en attente, insère le catalogue (20 meubles) seulement s'il est vide, et crée l'administrateur seulement s'il n'existe pas. `ADMIN_EMAIL` / `ADMIN_PASSWORD` peuvent aussi être renseignés dans `.env`.

## Tests

```bash
npm test -w @digimmo/back            # unitaires
npm run test:e2e -w @digimmo/back    # e2e (PostgreSQL et MongoDB requis, base digimmo_test)
```
