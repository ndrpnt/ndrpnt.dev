# Managing Static Secrets in Infrastructure Code

I’ve been exploring how to handle static secrets in infrastructure codebases.
Think API keys in Terraform configuration, or database passwords in Kubernetes manifests.
These notes document my current approach and, more broadly, my mental model of the problem space.

<!-- I'll deliberately not tackle strategies that involve making the application aware (directly or through a sidecar) of how secrets are managed. E.g. system that rely on regularly rotated short-lived secrets, or systems that rely on workload identity to avoid credentials altogether. -->

## Step 1: Don't

No matter how you handle sensitive values, any human or application that has had access to a secret can share it, leak it, or keep a copy of it. That is, completely offline, without any way to audit, and even after revoking their access. <!-- To reduce the risk you want to make secret rotation painless, and do it often. --> To reduce the risk you want to make secrets short-lived, and to reduce the number of places you store them in or the number of times you manipulate them

In modern (cloud) environment it is often possible to avoid long-lived secrets altogether.
This usually implies workload identity (offered by your infrastructure provider or using  [SPIFFE](https://spiffe.io/)) combined with identity federation (usually with OpenID Connect) or [auto-rotated or dynamic secrets](https://www.hashicorp.com/en/blog/rotated-vs-dynamic-secrets-which-should-you-use).
This involves one or more trusted third party services as well as making the application (or a sidecar) aware of the authentication flow.
Sadly I haven't worked in that kind of environment so I'm a bit fuzzy on how this would be setup.

Those are preferable precisely because you reduce the number of long-lived credentials, and thus avoid the problem this document talks about. However these strategies might be complex or impossible to setup depending of your infrastructure provider, and the maturity of your organisation as a whole. All of this applies to application that consume externally managed services, but if you yourself are building the infrastructure / platform, you have a bootstrap problem that'll likely require you to store static credentials.

<!-- In order to do without static secrets, you must usually rely on a trusted third party. Application on both side of the communication have to be aware of that third party and  trust it. Authentication then 1) becomes an infrastructure problem and 2) requires modifying the application (or have a sidecar run alongside it). This require infrastructure (e.g. Hashicorp Vault. -->

## Concepts

A **secret store** is a stateful application that durably stores static secrets and offers an API to do CRUD operations. Is is often akin to a KV store with a nice UI and an emphasis on security. For example accessing the secret metadata and the secret value are separate operations. They create a second source of truth: the code contains an indirection to the store, that stores the secret. Both have to be kept consistent. One needs to work on data durability: that additional, stateful, component must be backed-up and/or replicated in multiple locations, and ideally providers.

A **secret manager** ntegrates with other services (databases, APIs, etc.) to rotate secrets and even generate dynamic, on-demand, short-lived credentials. It can be considered stateless for some use cases: administrators _configure_ the integration with other services, and users request a dynamically-generated value. If unplanned secret rotation is not acceptable, a secret manager has to be considered like a stateful application, and appropriate measure must be taken to minimize data loss.

For our purposes, a **Key Management Service (KMS)** is a service that manages encryption keys and offers two operations: `encrypt`, that accepts some plaintext and returns a ciphertext, and `decrypt`, that accepts a ciphertext and returns the corresponding plaintext. These functionalities are often called Cryptography (or Encryption) as a Service, and are technically just a subset of the features of a KMS. Using a KMS, allowed users can go from plaintext to ciphertext and back, without managing any key themselves. There is a lot more to [key management](https://en.wikipedia.org/wiki/Key_management) that I'm less familiar with, but that's beside the point of this post.

All these services offer similar security features: requests authentication, authorization and audit, encryption using some kind of key hierarchy, granular access control, key rotation, versioning, policies (conditions, single-time access, etc.), etc.

This taxonomy of secret management tools and practices it idiosyncratic. The distinction between secret _stores_ and secret _managers_ is somewhat arbitrary but helps my mental model.

## What about Git?

Needless to say, storing sensitive values in a Git repository is a bad idea. For one, it is a _distributed_ VCS so you quickly end up with clones on multiple machines. Mistakes happen, repositories become public, get pushed to the wrong remote, etc. Also, you pass on granular access control and audit logs. Also, nobody handles a Git repository like a very sensitive artifact: not you nor other users, not admins of your forge, not even your forge itself or your CI system, and not backups.

## Secret Store vs. KMS

In my (arguably very limited) experience, I have broadly encountered two ways of storing static credentials in infrastructure codebases: in a secret store or encrypted in Git alongside the rest of the configuration.

* **Workflow**
  * branching, atomicity, review, diff, merge
  * [KMS] Permet un versionnement/une historisation des modifications directement dans Git, profitant de toute sa puissance (commits = messages d'explication + date + lien avec merge request / ticket + other related modifications + signature)
  * [secret store] Offers at best a much poorer versioning experience, that is deleted if you delete the secret. Audit logs might also help.
  * [KMS] Permet les modifications atomiques affectant à la fois des valeurs sensibles et le reste de la configuration, réduisant ainsi le risque d'incohérence;
  * [KMS] Stocker les secrets chiffrés dans le dépôt Git permet d’exploiter pleinement les fonctionnalités de Git, en particulier les branches. On pourra créer une branche temporaire, y ajouter des secrets, puis la supprimer ou la merge. À l’inverse, un Secret Manager se retrouve vite pollué par des secrets qui ne sont plus utilisés;
  * [KMS] Enable branching, code reviews, atomic merge of both the secret and its call site, code change proposition that can be refused (doing that with a secret store means that the secret must be pushed when the rest of the code is merged, or it must be delete if the MR is refused);
  * [secret store] Un Secret Manager est facilement pollué par des valeurs obsolètes. Stocker les secrets dans le dépôt assure une plus grande cohérence avec le reste du code d'infrastructure;
  * [secret store] Suivant comment on importe les secrets dans son code d'infrastructure, il est commun de ne pas être capable de savoir quels secrets sont déployés sans regarder dans le secret store. Par exemple si le code d'infrastructure exprime "créer une variables d'environnement pour chaque secret stocké sous la clé foo"
  * [secret store] Édition "as-code" complexe (besoin de faire un script), par exemple pour faire des modifications de masse (bulk)
  * Secret stores forces you to manage sensitive values as data, while KMS let you manage them as configuration, which they are.
  * [secret store] Requires a structure and naming strategy to organize 100s of secrets;
* **Working with auto-rotated and dynamic secrets**
  * [secret store] Outil unique pour gérer les secrets statiques (modifiés par des humains) et dynamiques (modifiés par des machines). Often also a secret manager. That said, secret managers often don't require credentials themselves to be uploaded, only the intention to create one. Thus they can be configured "as code" like any other infrastructure ressource. While secret stores cannot be configured "as code" because that would require storing a secret in the code, but avoiding that is the whole point of using a secret store in the first place.
* **Ease of use**
  * [KMS] diff, log, merge cryptiques car fichiers chiffrés, requires some git and terminal mastery. It also likely requires locally installing a tool to encrypt/decrypt files.
  * [secret store] require learning a new tool with a likely subpar UI/CLI)
  * [KMS] Requires users to manage their own private key or KMS credentials in terminal
  * [secret store] users just log in a UI, ideally with SSO.
  * [KMS] Opérations git (diff, merge, …) douloureuses (mais possibles) et historique cryptique car les fichiers sont chiffrés;
  * [secret store] Plus facile d'accès, généralement au travers d'une interface graphique;
  * [secret store] Historique absent ou difficilement exploitable : désagréable à naviguer, difficile à mettre en cohérence avec le reste de la configuration, pas familier comme avec Git;
  * [secret store] Gestion de la cryptographie abstraite, which reduce complexity
* **Risks**
  * [KMS] Leaks by committing secret in plaintext
* **Availability and disaster recovery**
  * [KMS] it's just configuration/code. It piggybacks on everything you already have in place for the rest of your code, and is distributed version control anyway so you likely have many copies.
  * [KMS] One need a strategy in case the KMS goes down or even when keys are permanently lost. There are multiple ways to do that, either by storing a recovery key in the form of a QR code in a physical safe/vault, or by requiring multiple users to decrypt a recovery key
  * [secret store] One should think about backing up their their secret store. Failures and (accidental) deletions happen.
* **Onboarding and offboarding**
  * [KMS] needs to think about the tradeoffs without a KMS)
  * [KMS] Problématique d'onboarding, d'offboarding et de rotation de clés plus complexes à gérées: est-ce que les nouveaux peuvent déchiffrer les versions datants d'avant leur arrivée ? est-ce que les anciens peuvent déchiffrer les versions datants d'après leur départ ? La meilleur réponse est d'utiliser un KMS, ce qui revient à donner et retirer l'accès aux clés aux membres de l'équipe;
* **Access control**
  * système d'IAM supplémentaire d'un outil dédié ou bien intégration à celui existant de notre cloud provider ? Politique de ségrégation avec différentes clés pour chiffrés différents secrets ?
* I personally feel more confortable using all my usual tools locally in a terminal (editor, VCS, etc.), than navigating a UI.

## Other considerations

In this article I do not account for related, but mostly orthogonal considerations like ensuring sensitive values are never persisted to disk, or that they are [not stored in environment variables](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html#51-injection-of-secrets-file-in-memory) to prevent them being accessible to other processes, or included in logs or system dumps.

## SOPS

* Data keys must be rotated regularly, and whenever someone is offboarded, with `sops rotate`. Otherwise someone that was authorized on the KMS could have kept a copy of the plaintext data key, and can decrypt secrets offline (without calling the KMS), _including new entries added using the same data key_.
* SOPS is popular enough that there exists integration with many other ecosystems: [Nix](https://github.com/Mic92/sops-nix), [Flux CD](https://fluxcd.io/flux/guides/mozilla-sops/), [Ansible](https://docs.ansible.com/projects/ansible/latest/collections/community/sops/docsite/guide.html) to name a few

-------

## Propositions

Le choix de stratégie de gestion des valeurs sensibles vas aussi influer les problématiques suivantes :


_note sur l'offboarding et la rotation de clé de chiffrement : une fois qu'une personne a eu accès à un secret, le seul moyen de s'assurer qu'elle ne peut pas l'utiliser est de faire tourner le secret. Ça reste vrai quelque soit la stratégie de gestion choisie._

* Encrypting with each member's public key makes the `git` history only accessible up to the date of joining the team
* Encrypting with a single team-wide key requires sharing a private key between members and makes offboarding marginally less secure (leaving members can keep the key)
* In all cases, the deployment tool likely needs a keypair of its own, which will be accessible to all members of the team

TODO: mettre ces propositions à l'épreuve des requirements suivants: https://youtu.be/5Af1f1IxO7E?si=1WFr0RUaptDLDp5M
+ ability to add a social component security, by requiring X out of Y keys to decrypt a secret
+ ability to share secrets between humans
