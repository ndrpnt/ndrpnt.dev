---
title: Infrastructure as…
description: "Infrastructure as…"
date: 2024-11-25
---

## Infrastructure as Code

_Infrastructure as Code_ dénote l'évolution d'**actions interactives** ou physique,
réalisées manuellement par des humains (et éventuellement documentées),
vers des scripts impératifs ou de la **configuration déclarative**
exécutés ou interprétés par des machines.

Il devient possible d'appliquer aux fichiers texte qui en résultent,
aussi appelé code,
des pratiques de développement telles que le versionnage,
les revues de code,
les vérifications automatisées (tests fonctionnels ou de conformité),
ou encore l'intégration continue.

L'IaC facilite les modifications à grande échelle,
réduit le risque d'erreur humaine,
et offre une base initiale de documentation de l'infrastructure.
Ces pratiques permettent de garder la maîtrise de son infrastructure sur la durée,
malgré les évolutions des exigences et des équipes.

Des questions de vitesse de prototypage,
de découvrabilité (des services et de leurs relations),
ou encore de maturité (des équipes et des outils)
peuvent justifier le recours à des actions manuelles,
souvent par le biais d'une interface graphique ou d'un terminal.

## ~~Infrastructure~~ Configuration as Data

Le concept de _Configuration as Data_ est récent (2020 ?) et semble être la suite logique de l'_Infrastructure as Code_.

La suite logique est l'accroissement du nombre de fichiers de configuration (déclarative) à gérer, jusqu'à nécessiter des outils agissant directement sur cette configuration, et ce faisant la traitant comme de la donnée.

Le concept de _Configuration as Data_ reconnaît cet état de fait, et explicite l'intérêt de s'accorder sur un format de donnée (le [Kubernetes Resource Model](https://github.com/kubernetes/design-proposals-archive/blob/main/architecture/resource-management.md) en ce qui nous concerne). Ainsi, l'adoption d'un format de configuration commun et la création d'outils capables d'ingérer et/ou d'émettre des données suivant ce même standard créent un cercle vertueux en offrant la possibilité de "chaîner" différents traitements indépendants.

On peut trouver une explication du concept de _Configuration as Data_ et des qualités recherchées dans [la documentation `kpt`](https://github.com/kptdev/kpt/blob/main/docs/design-docs/06-config-as-data.md) ainsi que dans [cette vidéo](https://youtu.be/kvdKvcfYrm8). Les ressources précédentes restent cependant abstraites, puisque qu'il ne s'agit pas d'un outil, mais de prendre du recul, d'expliciter, et de théoriser un état de fait.

## Infrastructure as a Program

## Infrastructure as a big ball of mud
