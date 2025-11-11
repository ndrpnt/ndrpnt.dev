# IaC Secret Management Strategies

This article is about the different strategies to manage static secrets in an infrastructure codebase. This includes API keys, database password, etc. referenced in Kubernetes manifests or Terraform code.

I'll deliberately not tackle dynamic secrets and more generally strategies that involve making the application aware (directly or through a sidecar) of how secrets are managed. E.g. system that rely on regularly rotated short-lived secrets, or systems that rely on workload identity to avoid credentials altogether.

Those are preferable precisely because you reduce the number of long-lived credentials, and thus avoid the problem I am talking about. However these strategies might be complex or impossible to setup depending of your infrastructure provider, and the maturity of your organisation as a whole.

In my arguably very limited experience, I have seen two ways of managing secrets in infrastructure codebases:

* Using a _secret manager_, i.e. an secure external tool with authentication and authorization capabilities specialized in storing sensible values. Usually in simple key/value format, sometimes with added capabilities like secret rotation, one-time access, etc.
* Storing encrypted sensible values in Git, alongside the rest of the infrastructure code.

## Propositions

Il existe deux principales stratégies pour gérer des valeurs sensibles :

* Les stocker chiffrées directement dans un dépôt git :
  * Permet un versionnement/une historisation des modifications;
  * Permet les modifications atomiques affectant à la fois des valeurs sensibles et le reste de la configuration, réduisant ainsi le risque d'incohérence;
  * Risque de commit en clair;
  * Opérations git (diff, merge, …) douloureuses (mais possibles) et historique cryptique car les fichiers sont chiffrés;
  * Problématique d'onboarding, d'offboarding et de rotation de clés plus complexes à gérées: est-ce que les nouveaux peuvent déchiffrer les versions datants d'avant leur arrivée ? est-ce que les anciens peuvent déchiffrer les versions datants d'après leur départ ?
  * La meilleur réponse est d'utiliser un KMS, ce qui revient à donner et retirer l'accès aux clés aux membres de l'équipe;
  * Stocker les secrets chiffrés dans le dépôt Git permet d’exploiter pleinement les fonctionnalités de Git, en particulier les branches. On pourra créer une branche temporaire, y ajouter des secrets, puis la supprimer ou la merge. À l’inverse, un Secret Manager se retrouve vite pollué par des secrets qui ne sont plus utilisés;
* Les stocker dans un outil externe type _Secret Manager_ :
  * Plus facile d'accès, généralement au travers d'une interface graphique;
  * Édition "as-code" complexe (besoin de faire un script);
  * Historique absent ou difficilement exploitable : désagréable à naviguer, difficile à mettre en cohérence avec le reste de la configuration;
  * Outil unique pour gérer les secrets statiques (modifiés par des humains) et dynamiques (modifiés par des machines);
  * Gestion de la cryptographie abstraite;
  * Pas toujours agnostique du consomateur : par exemple dans un contexte multicloud, plusieurs Secrets Managers seront nécessaires;
  * Stratégie de backups plus complexe;
  * Un Secret Manager est facilement pollué par des valeurs obsolètes. Stocker les secrets dans le dépôt assure une plus grande cohérence avec le reste du code d'infrastructure;
  * Suivant comment on importe les secrets dans son code d'infrastructure, il est commun de ne pas être capable de savoir quels secrets sont déployés sans regarder dans le Secret Manager. Par exemple si le code d'infrastructure exprime "créer une variables d'environnement pour chaque secret stocké sous la clé foo"

Le choix de stratégie de gestion des valeurs sensibles vas aussi influer les problématiques suivantes :

* Gestion des accès : système d'IAM supplémentaire d'un outil dédié ou bien intégration à celui existant de notre cloud provider ? Politique de ségrégation avec différentes clés pour chiffrés différents secrets ?
* Comment les secrets vont-ils être déployés, et comment vont-ils être consommés par les applications : injecter en variables d'environnement ? Synchronisés avec des secrets Kubernetes ? Consommés directement par les applications depuis le secret manager ?
* Capacité et facilité de rotation des secrets

Nous explorerons exclusivement la 1ère stratégie

_note sur l'offboarding et la rotation de clé de chiffrement : une fois qu'une personne a eu accès à un secret, le seul moyen de s'assurer qu'elle ne peut pas l'utiliser est de faire tourner le secret. Ça reste vrai quelque soit la stratégie de gestion choisie._

* Encrypting with each member's public key makes the `git` history only accessible up to the date of joining the team
* Encrypting with a single team-wide key requires sharing a private key between members and makes offboarding marginally less secure (leaving members can keep the key)
* In all cases, the deployment tool likely needs a keypair of its own, which will be accessible to all members of the team

TODO: mettre ces propositions à l'épreuve des requirements suivants: https://youtu.be/5Af1f1IxO7E?si=1WFr0RUaptDLDp5M
+ ability to add a social component security, by requiring X out of Y keys to decrypt a secret
+ ability to share secrets between humans

---

# Static Secret Management Strategies

## Step 1: Don't

* In modern architecture it is often possible to avoid using long-lived secrets altogether
* No matter how you handle static credentials, any human or application that has had access to a secret. Copy it, share it, leak it. All that without auditing
* For you must work on your ability to rotate them

### Workload Identity

* No credentials
* Centralise authorization

### Secret Manager

* Integrates with other services (databases, APIs, etc.) and generates dynamic, short-lived credentials to access them.
* Can be considered stateless for some use cases: administrators _configure_ the integratation with other services, and users request a dynamically-generated value. If unplanned secret rotation is not acceptable, a secret manager has to be considered a stateful application the sense that it does not store long-lived data,
* Centralise authorization

## Secret Store

* Stateful, durably stores static secrets
* Mostly just a KV store with an emphasis on security: encryption, granular access control, versioning, policies (conditions, single-time access, etc.) audit, etc.
* The code contains an indirection, and the store. Both have to be kept consistent.
* One needs to work on data durability: that additional, stateful, component must be backed-up and/or replicated in multiple locations, and ideally providers.
* The distinction between secret _store_ and secret _manager_ is somewhat idiosyncratic, as most products combine features of both. Nevertheless I think making this distinction helps building a clearer mental model.

## KMS

## Other considerations

Related, but mostly orthogonal considerations:

* Ensure sensible values are never written to disk, 
* Ensure sensible values are [not stored in environment variables](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html#51-injection-of-secrets-file-in-memory) to prevent them being accessible to other processes, or included in logs or system dumps.
