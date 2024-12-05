---
title: Infrastructure as…
description: "Infrastructure as…"
date: 2024-11-25
---

## Infrastructure as Code

_Infrastructure as Code_ dénote l'évolution d'**actions interactives** (éventuellement documentées) vers des **scripts impératifs** dans un premier temps, puis **de la configuration déclarative** auxquels il est possible d'appliquer des pratiques de développement comme le versionnage, les revues de code, ou encore l'intégration continue.

## ~~Infrastructure~~ Configuration as Data

Le concept de _Configuration as Data_ est récent (2020 ?) et semble être la suite logique de l'_Infrastructure as Code_.

La suite logique est l'accroissement du nombre de fichiers de configuration (déclarative) à gérer, jusqu'à nécessiter des outils agissant directement sur cette configuration, et ce faisant la traitant comme de la donnée.

Le concept de _Configuration as Data_ reconnaît cet état de fait, et explicite l'intérêt de s'accorder sur un format de donnée (le [Kubernetes Resource Model](https://github.com/kubernetes/design-proposals-archive/blob/main/architecture/resource-management.md) en ce qui nous concerne). Ainsi, l'adoption d'un format de configuration commun et la création d'outils capables d'ingérer et/ou d'émettre des données suivant ce même standard créent un cercle vertueux en offrant la possibilité de "chaîner" différents traitements indépendants.

On peut trouver une explication du concept de _Configuration as Data_ et des qualités recherchées dans [la documentation `kpt`](https://github.com/kptdev/kpt/blob/main/docs/design-docs/06-config-as-data.md) ainsi que dans [cette vidéo](https://youtu.be/kvdKvcfYrm8). Les ressources précédentes restent cependant abstraites, puisque qu'il ne s'agit pas d'un outil, mais de prendre du recul, d'expliciter, et de théoriser un état de fait.

## Infrastructure as a Program

Mise en évidence de tendances naturelles constatées de manière répétée :

* À complexifier des inputs des variables imbriqués proche d'un DSL
* À créer des indirections qui augmentent la complexité sans rien apporter en retour
  * Parce que DRY: on rend générique pour réutiliser
  * Parce que dans un programme, contrairement à un script, on découpe: petite functions, petits fichiers, petits modules unitaires, single-responsibility principle
  * Parce qu'on ne manipule pas de la pitoyable infrastructure, on abstrait pour créer un "univers" plus haut niveau
  * Parce qu'on découple, on choisit arbitrairement d'être agnostique de ceci ou de cela (du provider cloud, du type d'infrastructure sous-jacente, de la distro Linux, de la techno de BDD, …)
* À vouloir couvrir "le dernier kilomètre" à tout prix.
  * Le graal ultime est un setup qui bootstrap toute l'infrastructure en un clic
  * Le principe de Pareto s'applique: 80% du travail engendre 20% de la complexité de la base de code. On est dans le happy path des outils. Et puis on veut faire "le dernier kilomètre".
    * Bootstrapping: Terraform manage le bucket de son state, et ses permissions IAM. Le cluster d'administration Kubernetes (Crossplane, Cluster API, …) se manage lui même, ArgoCD se manage lui même.
    * Glue entre les outils: Terraform exécute Ansible dans un provisioner, Ansible exécute Terraform au sein d'un playbook. Terraform provisionne un cluster Kubernetes et le bootstrap pour qu'ArgoCD prenne le relais.
    * Intégration à la CI/CD: Atlantis with Terragrunt and multiple layers, exécution de Terraform/Ansible dans la chaîne de CI/CD
  * "automate when its boring". Il est important de garder la maîtrise de ce que nous "programmes"/scripts/pipelines font. C'est parce qu'on sait le faire manuellement qu'on sait l'automatiser.

## Infrastructure as a big ball of mud

Horror stories vécues, conséquences d'une mentalité (programmation) en décalage avec les outils (IaC)

* Le DSL dans les tags Terraform qui dictent le comportement qu'Ansible adopte (_mission Dimail_)
* Le templating de template de template
  * ArgoCD > Helm > ArgoCD > Helm > ArgoCD > Helm (_mission NexSIS_)
  * Ansible > Terraform (_mission MAS_)
* Les 14 layers Terragrunt pour déployer 5 VMs (_mission DGAC_)
* J'ai bossé sur un projet où le lien entre un changement d'input ou de code Terraform et le plan généré n'était plus évident. Il y avait de la logique, des abstractions dans Terraform. Un embedded DSL avec des notions de tags, de rôles, de groupes qui étaient ensuite parsés pour créer ou non des ressources. Ce grand nombre d'indirection, en plus d'être parfaitement idiosyncratique, rendait toute modification difficile, nous forçant à passer par des outputs intermédiaires en lieu et place des fameux printf de débogage.
* L'accumulation d'indirections pour gérer de la configuration Kubernetes. Avec souvent un empilement de templating, d'overlay/patching, différents dépôts, de la logique un peu partout (local, CI, in-cluster), différentes sources de variables, différentes politiques de default, etc. À laquelle il faut ajouter la logique (dynamique et asynchrone !) au runtime de Kubernetes.
  * Les 7 niveau d'outillages pour générer des manifestes Kubernetes (_mission MAS_)
* Le code Ansible qui s'effondre sur lui-même: le graphe de dépendances des rôle devient intractable (et 100 fois cyclique), aucun playbook ne passe, rien ne peut être lancé individuellement, chaque changement casse un autre rôle (_mission MAS_)

## TODO

### Encapsulation considered harmful?

> Encapsulation manages access to protect data integrity (you can't mess with the implementation).

* You don't want to encapsulate:
  * if you want your component (i.e. a code unit: a function, class, module, role, library, package, namespace, …) to be useful to many users, you want to expose every knobs to them.
  * On the other hand, any knob that is irrelevant to your user, or any resource that you don't need is added complexity that you must deal with anytime you interract with that component (deploying, editing, debugging, …)
  * Another path is to specialise the component, at the cost of losing genericity. This only make sense within a project, there is not point distributing that component as it is hard-coded for a specific use-case. And as said earlier, infrastructure being a lot about integration, there is very little place for opinion on the details because they are specific to every context.
  * Resources (tasks, Terraform/Kubernetes resources, GitLab jobs) are usually deeply orthogonal, that's the goal of a good API design. Thus, only a small minority of attributes are coupled and should stay coherent and evolve together. That is, there are only so many invariants that you want to enforce through encapsulation. Most of the attributes can be configured independently, which means that there can only be very little data encapsulation, merely a pass-through component, that passes-through values to the underlying resources.
* Examples
  * Depend on a module in Terraform, any attribute of any resource that you can't modify through the module API is a potential deal breaker for a module user. There is no reason to bend your usecase to integrate with a community module
  * Depend on a role in Ansible, any configuration element that you can't modify the way you want may prevent you from using that module

### Abstraction considered harmful?

> Abstraction manages complexity to simplify usage (you don't care about the implementation).

* You don't wan't to abstract:
  * Consumers/users are interested about the implementation. You want you abstractions to leak. When working on infrastructure, the concrete underlying/internal resources is all that matter.
  * No serious project can be satisfied with "a Kubernetes cluster that just works". You want a Kubernetes cluster that integrates with your authentication system, that checks your security boxes, that you feel confident running day 2 operations (monitoring, upgrading, repairing, …), that you can explain, evangelize and document, in which your are proficient in to accommodate for new requirements, …
  * Once again specialisation is the answer, but only makes sense within a given organization. Then it's not really an "abstraction", as much as it is a concrete opinionated implementation, a paved road/golden path.
* Examples
  * Depend on a module in Terraform, the plan shows you every single attribute of every single resource. When an error happen, it happen at the individual resource level, not at the module level.
  * Depend on a role in Ansible, the execution show you the result of every single task. When an error happen you have direct vision of the failed task.

### Testing

* Can't test at the same abstraction level. When talking about end-user specialized modules (i.e. not generic library modules) deploying basic infrastructure (i.e. not an application like FaaS, S3 website, or an image containing an application), the ideal Terraform unit test framework would end up being your Terraform code itself. That is, you want to assert/verify that exactly the resources you want are created, in exactly the state you want. Well, that is what you already described in your Terraform code. Maybe writing the same thing in a different syntax reduces the chance to make mistakes but that's about it.
* Terraform code as well as code to generate Kubernetes manifests have the interesting property of serializing their complete behavior (except some things like `ignore_changes` or provisioner blocks) in the form of Terraform plan or rendered Kubernetes manifests respectively. That means that refactoring is extremely safe: if the plan indicates that no change will happen, or if git diffing the rendered manifests yields an empty result, then it is safe to assume that the refactor didn't affect the behavior of the code. Traditional programs don't offer that kind of guarantees, hence we test them to build confidence that refactoring didn't unexpectedly negatively affect behavior (= cause a regression). Unlike the IaC examples though, only a finite number of states are explored with automated verification, hence we build confidence but can't guarantee that no regression happened.

## Templates instead of library

* As IaC behaves more like configuration than, libraries are largely inappropriate
* What about patching (layers) ?

## Infrastructure as Glue

* [rephrase] Les outils d'IaC sont par définition des outils à la frontière de l'infrastructure. Cette frontière est rarement bien définie proprement. Au mieux c'est une API HTTP, mais même ça c'est pas toujours de qualité suffisante et ça cache mal la complexité sous-jacente. Au pire c'est une machine dont on suppose connaître l'OS, la distro, l'architecture, la configuration, les utilitaires installés, leurs versions, … sinon notre code d'infrastructure s'effondre.
* Exemple: Terraform, et en particulier ses providers, c'est aussi une abstraction leaky. La qualité du code est douteuse, et bien souvent la qualité des APIs cibles l'est tout autant
* Pareil pour Ansible qui est un outil avec une forte ADN sysadmin. Faire scaler le code des modules est un afterthought. Pas/peu de test, pas/peu de framework
* Les abstractions sont donc dépendantes du bon fonctionnement de l'outil et s'effondrent souvent quand ce n'est pas le cas. Toute complexité ajoutée par dessus rend plus difficile de débogger les problèmes issus de fondations fragiles

## Raw notes

On ne programme pas de l'infrastructure à ce code c'est-à-dire on ne développe pas comme une application business avec de la logique métier. Quand on fait une infrastructure à ce code on va se contenter d'avoir du code plat qui décrit nos ressources. On évite de créer un domaine à un univers d'abstraction avec ses codes propres comme on ferait dans une grosse application java par exemple. On se contente de décrire l'infrastructure cible avec le monde en direction possible et le plus de transparence. C'est une erreur commune en tout cas à mon sens Et les débutants que de vouloir créer une abstraction plus métier entre guillemets. Ça se matérialise typiquement par une structure de données un peu où tout est factorisé et l'utilisateur n'a qu'à remplir cette structure de données et il y aura de la magie qui sera faite pour distribuer la bonne donnée au bon rôle la bonne donné au bon module exetera. En fait de mon expérience la réalité est jamais comme ça c'est-à-dire quand cette abstraction est tellement liquide et fuit tellement que aucun utilisateur peut vraiment l'utiliser sans aller regarder à l'intérieur. On ne peut pas juste lire la structure de données et sa documentation et se contenter de ça et remplir la structure de données et avoir confiance que notre code va faire la bonne chose. On va être obligé d'aller regarder ce qui se cache derrière cette structure de données derrière cette abstraction on va regarder le code et il se trouve que à ce code il va être beaucoup plus complexe parce que justement on a construit toutes ces abstractions tout ce tout ce monde ce domaine au lieu d'avoir bêtement à plat exposé techniquement ce qu'on faisait. Peut-être que c'est le fait de créer un monde ne faites créer ce genre d'abstraction c'est intéressant quand on quand on a du comportement à encapsuler. Il se trouve que quand on fait une infrastructure à ce que il y a peut-être 5 % de comportement et encore c'est très majoritairement de la pure description d'un état attendu qu'on va écrire. Faut quand même préciser que j'ai travaillé uniquement sur des codes base que je qualifierais de petites moyennes et sur des durées de maximum quelques années donc j'imagine que des codes base ça peut être différent pour les codes plus importante et qui ont la qui ont duré plus longtemps typiquement le monopo de votre boîte il y aura qui gère peut-être 200000 ressources terraform et sur lequel il y a des centaines de personnes qui collaborent pendant des dizaines d'années. Cette façon de programmer une infrastructure à ce code plus qualifierais de programmer, je l'ai rencontré j'en ai été victime déjà et je l'ai rencontré je pense chez toutes les personnes pour qui écrivait du l'infrastructure escort pour la première fois. Alors mon expérience se limite à teraform et ansible gitlabci. L'idée c'est qu'on nous demande pas de traduire une demande métier dans un langage de programmation et de le faire d'une façon qui sera maintenant par plein de personnes sur plein d'années l'infrastructure score c'est simplement écrire dans les fichiers texte les ressources cloud typiquement existante. L'intérêt c'est juste de pouvoir éditer ses ressources cloud garder traces de ses ressources cloud ou aussi simplement qu'on ait dit des lignes de texte. Donc infrastructure score c'est les pratiques de gestion de code appliquer à des ressources d'infrastructures point on parle de versionning on parle de collaboration on parle de faire des poules request d'avoir des revues de code on parle de pouvoir éditer des centaines de lignes donc des centaines de ressources en quelques secondes on parle d'avoir des standards facilement renforçables puisque il suffit de lire un fichier texte pour voir si ils sont respectés et cetera exetera.
Il y a aussi le fait que les abstractions très facilement et pour pour éviter ça il faut investir fortifacto faut documenter faut tester faut connaître comment ça va être utilisé et cetera. Je pense que dans du code d'infrastructure on consomme jamais une abstraction sans voir ce qu'il y a à l'intérieur je m'imagine pas consommer un module terraform sans prendre connaissance des des ressources sous-jacentes qui vont être créé sur mon club provider je veux maîtriser ça point de la même façon je me je m'imagine pas consommer un rôle antivol sans savoir quelle commande vont être faites sur la machine. Aussi et c'est typiquement vrai d'un rôle antivol ça ne ça ne marche pas tout seul ça ne marche juste pas tout seul c'est-à-dire que bah vous le lancez et ça va planter parce que la machine elle est pas dans un état attendu ça va planter parce que le bah vous êtes pas sur la bonne bistrot d'os. Donc on peut pas dans le contexte de code d'infrastructure en tout cas c'est très rare d'avoir des abstractions qu'on peut consommer de manière boîte noire quoi elles ont vraiment tendance à fuir même avec beaucoup d'efforts de design et de documentation.
Se référer aussi à mes notes sur le fait que l'infrastructure est conne ça se prête mal à importer des librairies ou des framework à consommer des abstractions point et que bah là dedans là il y a une grande valeur au template. Je pense que l'article peut se faire trois ou quatre parties ou l'article ça serait le titre ça serait ouvrier « infrastructure as …» et il y aurait trois ou quatre chapitres:

Peut être que le faible intérêt d'abstraire vient du fait qu'il est impossible d'encapsuler du desired state. Dans un module kubernetes ou bien dans un rôle OpenVPN, toutes les entrailles sont exposées: on sait qu'on va créer un VPC, 3 instances, 2 security groups, et des règles IAM. On sait qu'on va déposer un fichier de configuration et installer un package et créer un dossier. Et on veut le savoir. ce n'est pas un détail d'implémentation dans une boite noire qui nous répond correctement. Ce sont les ressources même que nous essayons de créer. Vu que c'est la raison même de notre code, on a une grande opinion sur ces ressources. On veut qu'elles se conforment précisément à nos attentes (les bons tags, le bon nom, les bonnes options, etc.). C'est comme si dans une librairie d'un langage de programmation on avait un avis sur le nom des variables encapsulées. Si une classe devait permettre au consommateur de choisir le nom qu'ils souhaite pour ses champs privés, on ne voudrait probablement plus importer cette classe d'une librairie externe dont on dépend. On voudrait copier coller le code de cette classe et s'en servir comme template pour développer notre propre classe spécialisé pour nos besoins. Aussi, en tant qu'auteur de la librairie, si on savait que les utilisateurs allaient copier/coller notre code, on n'écrirait pas la même chose: pas besoin de variabiliser, dans tous les cas les utilisateurs veulent hardcoder leur use case. Pas besoin de penser générique, mieux vaut bien assumé le cœur de sa responsabilité avec du code simple, afin de faciliter au consommateur l'ajout de son code spécifique.

* Les types d'IaC que je vois le plus souvent et sur lesquels je peux trouver des examples: GitLab-CI, ressources Kube (typiquement Helm + ArgoCD), Terraform (ou équivalent OpenTF, Pulumi), Ansible.
* Quid des Dockerfile ?
* On pourrait aussi parler des Makefiles, et des scripts en général. ils deviennent problématiques lorsqu'ils sont considérés comme des programmes à part entière et plus simplement des scripts. Le problème vient du fait que les langages sont fragiles, que ces bouts de code ne sont généralement pas testés, qu'ils font la glue entre des outils qui évoluent, qu'ils sont exécutés dans des contextes divers (différents OS, différentes version d'utilitaires, différents setups personnels, …). Ajouter des indirection et "construire un univers" rend plus complexe que nécessaire un bout de code dont _il est attendu qu'il dysfonctionne régulièrement_.

Il me semble que les software engineers plus expérimentés dans l'IaC montrent souvent une aversion pour les indirections dans ce contexte, là où les plus novices sont naturellement tentés d'en ajouter.

Doit on faire du infra as a program ? Well ça dépend si tu es prêt à investir 1 ordre de grandeur de plus dans ton code d'infra. Si ça vaut le coup (valeur a proposer une abstraction, complexité encapsulable que tu veux encapsuler, nombre d'utilisateurs, …). Par exemple un controller kube c'est de l'infra as a program. Ou bien du SaaS aussi. On fait le lien avec les IDP. Une IDP c'est le passage de IaC à IaaP.
