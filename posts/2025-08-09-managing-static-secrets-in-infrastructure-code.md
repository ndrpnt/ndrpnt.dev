# Managing Static Secrets in Infrastructure Code

I've been exploring how to handle static secrets in infrastructure codebases.
Think API keys in Terraform configuration, or database passwords in Kubernetes manifests.
These notes document my current approach and, more broadly, my mental model of the problem space.

<!--
## Disclaimers, Stating the Obvious, and Other Considerations

I work on small to mid-size projects, <100 developers and usually a relatively centralised infrastructure codebase.
This practices might not apply broadly.
Also, I'm a security noob.
I am opinionated on how I want to work (fighting tool sprawl, centered on Git, local terminal tools over web UIs, etc.).

Needless to say, storing sensitive values in a private Git repository is a bad idea. For one, it is a _distributed_ VCS so you quickly end up with clones on multiple machines. Mistakes happen, repositories become public, get pushed to the wrong remote, etc. Also, you pass on granular access control and audit logs. Plus, nobody handles a Git repository like a very sensitive artifact: not you nor other users, not admins of your forge, not even your forge itself or your CI system, and not backups.

In this article I do not account for related, but mostly orthogonal considerations like ensuring sensitive values are never persisted to disk, or that they are [not stored in environment variables](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html#51-injection-of-secrets-file-in-memory) to prevent them being accessible to other processes, or included in logs or system dumps.

In this blog post I'll not cover sharing secrets between (non-technical) users.
Tools like Passbolt, Bitwarden, 1Password, KeePass, and many others can do that.

One thing important to always keep in mind is that once someone has had access to a sensitive value, regardless of the way it is managed, the only way to make sure it won't be used maliciously is to rotate it. Make that value useless and create a new one. I have personally yet to see a place where the offboarding procedure accounts for someone that exfiltrated all the secrets they could find.
-->

## Step 1: Don't

No matter how you handle sensitive values, any human or application that has had access to a secret can share it, leak it, or keep a copy of it. That is, completely offline, without any way to audit, and even after revoking their access. <!-- To reduce the risk you want to make secret rotation painless, and do it often. --> To reduce the risk you want to make secrets short-lived, and to reduce the number of places you store them in or the number of times you manipulate them

In modern (cloud) environment it is often possible to avoid long-lived secrets altogether.
This usually implies workload identity (offered by your infrastructure provider or using  [SPIFFE](https://spiffe.io/)) combined with identity federation (usually with OpenID Connect) or [auto-rotated or dynamic secrets](https://www.hashicorp.com/en/blog/rotated-vs-dynamic-secrets-which-should-you-use).
This involves one or more trusted third party services as well as making the application (or a sidecar) aware of the authentication flow.
Sadly I haven't worked in that kind of environment so I'm a bit fuzzy on how this would be setup.

Those are preferable precisely because you reduce the number of long-lived credentials, and thus avoid the problem this document talks about. However these strategies might be complex or impossible to setup depending of your infrastructure provider, and the maturity of your organisation as a whole. All of this applies to application that consume externally managed services, but if you yourself are building the infrastructure / platform, you have a bootstrap problem that'll likely require you to store static credentials.

<!-- In order to do without static secrets, you must usually rely on a trusted third party. Application on both side of the communication have to be aware of that third party and  trust it. Authentication then 1) becomes an infrastructure problem and 2) requires modifying the application (or have a sidecar run alongside it). This require infrastructure (e.g. Hashicorp Vault.

I'll deliberately not tackle strategies that involve making the application aware (directly or through a sidecar) of how secrets are managed. Secrets are accessed/decrypted at deploy time, or at runtime by specialized systems. -->

## Concepts

A **secret store** is a stateful application that durably stores static secrets and offers an API to do CRUD operations. Is is often akin to a KV store with a nice UI and an emphasis on security. For example accessing the secret metadata and the secret value are separate operations. They create a second source of truth: the code contains an indirection to the store, that stores the secret. Both have to be kept consistent. One needs to work on data durability: that additional, stateful, component must be backed-up and/or replicated in multiple locations, and ideally providers.

A **secret manager** integrates with other services (databases, APIs, etc.) to rotate secrets and even generate dynamic, on-demand, short-lived credentials. It can be considered stateless for some use cases: administrators _configure_ the integration with other services, and users request a dynamically-generated value. If unplanned secret rotation is not acceptable, a secret manager has to be considered like a stateful application, and appropriate measure must be taken to minimize data loss.

For our purposes, a **Key Management Service (KMS)** is a service that manages encryption keys and offers two operations: `encrypt`, that accepts some plaintext and returns a ciphertext, and `decrypt`, that accepts a ciphertext and returns the corresponding plaintext.[^1] With a KMS, authorized users can go from plaintext to ciphertext and back, without managing any key themselves.

All these services offer similar security features: requests authentication, authorization and audit, encryption using some kind of key hierarchy, granular access control, key rotation, versioning, policy enforcement (conditions, single-time access, etc.), etc.

This taxonomy of secret management tools and practices it idiosyncratic. The distinction between secret _stores_ and secret _managers_ is somewhat arbitrary but I like it.

## Where to Store Secrets?

In my limited experience, I have broadly encountered two ways of storing static credentials in infrastructure codebases: in a secret store or encrypted in Git alongside the rest of the configuration.

* **Workflow**
  * [KMS] branching, atomicity, review, diff, merge
  * [KMS] Permet un versionnement/une historisation des modifications directement dans Git, profitant de toute sa puissance (commits = messages d'explication + date + lien avec merge request / ticket + other related modifications + signature)
  * [secret store] Offers at best a much poorer versioning experience, that is deleted if you delete the secret. Audit logs might also help.
  * [KMS] Permet les modifications atomiques affectant à la fois des valeurs sensibles et le reste de la configuration, réduisant ainsi le risque d'incohérence;
  * [KMS] Stocker les secrets chiffrés dans le dépôt Git permet d'exploiter pleinement les fonctionnalités de Git, en particulier les branches. On pourra créer une branche temporaire, y ajouter des secrets, puis la supprimer ou la merge. À l'inverse, un Secret Manager se retrouve vite pollué par des secrets qui ne sont plus utilisés;
  * [KMS] Enable branching, code reviews, atomic merge of both the secret and its call site, code change proposition that can be refused (doing that with a secret store means that the secret must be pushed when the rest of the code is merged, or it must be delete if the MR is refused);
  * [secret store] Un Secret Manager est facilement pollué par des valeurs obsolètes. Stocker les secrets dans le dépôt assure une plus grande cohérence avec le reste du code d'infrastructure;
  * [secret store] Suivant comment on importe les secrets dans son code d'infrastructure, il est commun de ne pas être capable de savoir quels secrets sont déployés sans regarder dans le secret store. Par exemple si le code d'infrastructure exprime "créer une variables d'environnement pour chaque secret stocké sous la clé foo"
  * [secret store] Édition "as-code" complexe (besoin de faire un script), par exemple pour faire des modifications de masse (bulk)
  * Secret stores forces you to manage sensitive values as data, while KMS let you manage them as configuration, which they are.
  * [secret store] Requires a structure and naming strategy to organize 100s of secrets;
  * [KMS] storing secrets in plain textfiles in git makes it possible to run scripts and other automation. Be it in CI or locally, lint or codegen, etc.
  * [KMS] depending on your need, encrypting secrets in git makes it possible to access them offline.
  * [secret store] is only online. It is thus sensitive to network and service unavailability.
* **Working with auto-rotated and dynamic secrets**
  * [secret store] Outil unique pour gérer les secrets statiques (modifiés par des humains) et dynamiques (modifiés par des machines). Often also a secret manager. That said, secret managers often don't require credentials themselves to be uploaded, only the intention to create one. Thus they can be configured "as code" like any other infrastructure ressource. While secret stores cannot be configured "as code" because that would require storing a secret in the code, but avoiding that is the whole point of using a secret store in the first place.
* **Ease of use and familiarity**
  * [KMS] diff, log, merge cryptiques car fichiers chiffrés, requires some git and terminal mastery. It also likely requires locally installing a tool to encrypt/decrypt files.
  * [secret store] forces you to learn using a new, likely subpar and limited tool, be it a UI, API, or CLI.
  * [KMS] Requires users to manage their own private key or KMS credentials in terminal
  * [secret store] users just log in a UI, ideally with SSO.
  * [KMS] Opérations git (diff, merge, …) douloureuses (mais possibles) et historique cryptique car les fichiers sont chiffrés;
  * [secret store] Plus facile d'accès, généralement au travers d'une interface graphique;
  * [secret store] Historique absent ou difficilement exploitable : désagréable à naviguer, difficile à mettre en cohérence avec le reste de la configuration, pas familier comme avec Git;
  * [secret store] Gestion de la cryptographie abstraite, which reduce complexity
  * [KMS] Lets you use all your usual tools: CLIs, editor, VCS, etc.), than navigating a UI.
* **Risks**
  * [KMS] Leaks by committing secret in plaintext
* **Availability and disaster recovery**
  * [KMS] Encrypted secrets stored in Git are just code. They benefit from everything you already have in place for the rest of your code, and distributed version control means copies likely exist on multiple machines anyway.
  * [KMS] A recovery strategy is needed in case the KMS becomes unavailable or keys are permanently lost. Options include storing a recovery key (e.g. as a QR code) in a physical safe, or using threshold schemes that require multiple users to collaborate for decryption.
  * [secret store] Secret stores are stateful services that require their own backup strategy. Failures and accidental deletions happen.
* **Onboarding and offboarding**
  * [KMS] needs to think about the tradeoffs without a KMS)
  * [KMS] Problématique d'onboarding, d'offboarding et de rotation de clés plus complexes à gérées: est-ce que les nouveaux peuvent déchiffrer les versions datants d'avant leur arrivée ? est-ce que les anciens peuvent déchiffrer les versions datants d'après leur départ ? La meilleur réponse est d'utiliser un KMS, ce qui revient à donner et retirer l'accès aux clés aux membres de l'équipe;
* **Access control**
  * système d'IAM supplémentaire d'un outil dédié ou bien intégration à celui existant de notre cloud provider ? Politique de ségrégation avec différentes clés pour chiffrés différents secrets ?

## Local Keys vs KMS

To encrypt secrets and store them in Git, one needs an encryption key.
Users can generate their own keypairs and store them locally (e.g. SSH, GPG, or Age), or use a KMS and login via SSO.

Encrypting with each user's public key has shortcomings.

* Decryption is done offline, which makes audit impossible
* The Git history is only accessible up to the date of joining the team. Encrypting with a single team-wide key fixes that at the cost of requiring to share a key between users, which is not always done securely. Sharing a key between users also makes it impossible to keep track of who has access to what secret.
* Access cannot be revoked: once a user had their public key added, they keep access to secrets that were encrypted using their public key, even after leaving the team. It is even worse in case of a shared "team key": users can access secrets encrypted after they left the team.
* In all cases, when, tools likely need technical keys of their own, which will be accessible to all users of the team

[TODO] To fix that, use a KMS

Credentials that are used by tools to access the KMS must be rotated regularly, and whenever someone is offboarded. Otherwise someone that had access to the configuration of these tools could have kept a copy of their tokens and use them to decrypt data.

## SOPS

* Data keys must be rotated regularly, and whenever someone is offboarded, with `sops rotate`. Otherwise someone that was authorized on the KMS could have kept a copy of the plaintext data key, and can decrypt secrets offline (without calling the KMS), _including new entries added using the same data key_.
* SOPS is popular enough that there exists integration with many other ecosystems: [Nix](https://github.com/Mic92/sops-nix), [Flux CD](https://fluxcd.io/flux/guides/mozilla-sops/), [Ansible](https://docs.ansible.com/projects/ansible/latest/collections/community/sops/docsite/guide.html) to name a few.
* SOPS can encrypt files of any type. For supported structured formats (currently YAML and JSON), SOPS is able to encrypt files on a field by field basis, which drastically improves Git diffs and let user inspect the content of a file without decrypting it (only values are encrypted, keys are not).
* SOPS has no GUI. I think there is something missing here, maybe a read-only web UI that given a repo URL and some credentials can nicely let non-technical users browse the secrets they have access to.
* Good to know: you don't want to `sops decrypt` and then `sops encrypt` a file.
  That generates a new encryption key and muddies the diff,
  and it also makes it easy to commit secrets in plaintext.
  You should pretty much always use `sops edit` (with `$EDITOR` properly set)
  or `sops set` commands to modify a SOPS-encrypted file

### Disaster recovery

All is well and you use a KMS for day-to-day operations on secrets. But in case you delete a key, or the provider goes down, you need a recovery strategy.

One approach is to generate an (Age) key,
print it as a QR code,
and store it in a physical safe at a bank.
This works but requires some logistics that may not be practical.

Another approach is social recovery: use Shamir's secret sharing (SSS) to require $X$ out of $Y$ people to collaborate for decryption. No single person can decrypt on their own. For DR, enough team members need to gather.

You can combine both approaches, requiring both a certain number of people and a certain number of vaulted keys. I think that avoiding critical keys (that can't be lost) and master keys (that can decrypt on their own) is best.

### A digression on using Shamir's secret sharing

SOPS supports Shamir's secret sharing through its `key_groups` and `shamir_threshold` settings. This lets you express policies like "require the vaulted key plus 3 out of 5 team members to decrypt":

```yaml
# .sops.yaml

.keys:
- &vault age1f3sel9yn086hl0ylhptd4508eyvnz3gr7qhfmeh9shfh5fka2ghs0puy38
- &user1 age1g80rr8mnqmlkxnkk9qd2520fkh4upw9a20mt7yq8eu44hufsqgxq26ayvq
- &user2 age17faldzfrdfe4h56dur267cvn7kv8sy43jvw9ahs2zjkvq8wq2p0sg3x7mn
- &user3 age1tgfn2rhdapa4wqwkjkwm9f4547me847gnggay7hmmh0t8zj79qkqtqemgl
- &user4 age1w78r5xqv2nscura5p7kuksvs7nc4mvrh6fazgfe5wmag6vc9sgasva0dz4
- &user5 age13y0e4mfzxdw35yd7nt2l2wtevtexf52y3vj8ea3m2l0ddwgt0q8s3gw92f

creation_rules:
- path_regex: .yaml$
  shamir_threshold: 6
  key_groups:
  - age: [*vault]
  - age: [*vault]
  - age: [*vault]
  - age: [*user1]
  - age: [*user2]
  - age: [*user3]
  - age: [*user4]
  - age: [*user5]
```

The vault key appears in 3 groups, each user in 1. With threshold 6, you need the vault (3 groups) plus any 3 users (3 groups) to reach 6.

The formula: `shamir_threshold` should be at least `teamSize + 1` to ensure the vaulted key is required. Here, $5 + 1 = 6$. The vaulted key should appear in `shamir_threshold - requiredPeople` groups. Here, $6 - 3 = 3$.

To decrypt, gather the required keys in a file and run `SOPS_AGE_KEY_FILE=keys.txt sops decrypt secrets.yaml`:

```txt
# keys.txt
AGE-SECRET-KEY-1V4L8R9XPX3X9J7KX93D290NM8MKL70G7SGVFXDNJNV5HNFZWP7LS80RSFW
AGE-SECRET-KEY-1MWCJK9XRH7LDRCRS63TK2NKZLDYY2TTTCMLR2UFJK7EXVZRTN3JQ77HP5X
AGE-SECRET-KEY-16LHNHSTCDUAFU8SFT6ZSC7XLQ9QNM3JWVJCRUH47GY2NJWQDVS5SU27L2H
AGE-SECRET-KEY-18MU909SCG8ZY5HLJS6SJDS0G26A4GQJCX8RUU2QUPYUFEKCZ0LYQRVSSMU
AGE-SECRET-KEY-1VZV9M9LK6GKYQ38YMNAN88F0PSV4UARRRLGFEL94TUE3TFGCAL7QWT0UYV
AGE-SECRET-KEY-1W0THV98RHNQNQRUM2T0P4ZWYZACTDXTHREA4T0KJ2530AWG8MC8STHPCGU
```

We can create more complexe variations.
For example, we now require two vaulted keys plus 3 out of 5 users:

```yaml
creation_rules:
- path_regex: .yaml$
  shamir_threshold: 9
  key_groups:
  - age: [*vault1]
  - age: [*vault1]
  - age: [*vault1]
  - age: [*vault2]
  - age: [*vault2]
  - age: [*vault2]
  - age: [*user1]
  - age: [*user2]
  - age: [*user3]
  - age: [*user4]
  - age: [*user5]
```

Or we may want to require either of the two vaulted keys plus 3 out of 5 users:

```yaml
creation_rules:
- path_regex: .yaml$
  shamir_threshold: 6
  key_groups:
  - age: [*vault1, *vault2]
  - age: [*vault1, *vault2]
  - age: [*vault1, *vault2]
  - age: [*user1]
  - age: [*user2]
  - age: [*user3]
  - age: [*user4]
  - age: [*user5]
```

And we can go deeper!
If you want to require $X_A$ out of $Y_A$ keys from group $A$ and $X_B$ out of $Y_B$ keys from group $B$, you can achieve that with an indirection. Generate two intermediate keys, that you use to encrypt data with `shamir_threshold: 2`. Then, encrypt each intermediate key with its respective group's threshold.

All in all, SSS is flexible enough to model many access policies.

### Integrating SOPS with your editor

I personally kept it simple with a single `sops $(fd --type file sops | fzf)` alias
([fd](https://github.com/sharkdp/fd) is a alternative to `find`
and [`fzf`](https://github.com/junegunn/fzf) lets you filter the matching files).

If you use VSCode, you might be interested in setting `EDITOR=code --wait` in your `.bashrc`
and creating a [task](https://code.visualstudio.com/docs/debugtest/tasks)
that you can trigger by "building" the current file with `ctrl/cmd+shift+B`.

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "SOPS Edit",
      "type": "shell",
      // SOPS exits with status code 200 when no change are made.
      "command": "sops edit ${file} || [ $? -eq 200 ]",
      "presentation": {
        "close": true,
        "reveal": "never",
        "panel": "dedicated"
      },
      "group": {
        "kind": "build",
        // Run by default with ctrl/cmd+shift+B.
        "isDefault": "**.sops.*"
      }
    }
  ]
}
```

Of course you want to adapt it to match your way of managing credentials,
e.g. by passing environment variables or source them in your `command`.
I'm sure you can setup something similar in other editors as well.

[^1]: Technically these functionalities are just a subset of the features of a KMS. They are often called Cryptography (or Encryption) as a Service. There is a lot more to [key management](https://en.wikipedia.org/wiki/Key_management) that I'm less familiar with, but that's beside the point of this post.
