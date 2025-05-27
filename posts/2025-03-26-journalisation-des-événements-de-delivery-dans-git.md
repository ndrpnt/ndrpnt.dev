---
title: "[fr] Journalisation des événements de delivery dans Git"
description: |
  Au détour d'une discussion avec un collègue
  sur le calcul des métriques DORA,
  je n'ai pas pu m'empêcher de généraliser.
  Je me suis dit que beaucoup de données gagneraient à être archivées dans Git.
  Je vous partage mes reflexions en espérant vous inspirer, et avoir vos idées et commentaires.
date: 2025-03-26
---

Au détour d'une discussion avec un collègue
sur le calcul des métriques DORA,
je n'ai pas pu m'empêcher de généraliser.
Je me suis dit que beaucoup de données gagneraient à être archivées dans Git.
Par exemple les résultats jobs de CI, les déploiements, les incidents, …

Un des intérêts c'est de grandement simplifier
la collecte de métriques de delivery
([DORA][dora], [SPACE][space], [DX Core 4][dx-core-4] & co.),
qui est aujourd'hui contraignante pour un résultat mitigé.
Mon espoir est de rendre tout ça complètement générique,
suffisamment pour en faire un produit open source,
et d'ouvrir la porte à d'autres cas d'usage.

Actuellement nos outils
(GitLab, Jira, Prometheus, Kubernetes, …)
sont silotés et les intégrations se font une à une entre chaque composant.
J'aimerais bien voir Git servir de "glue".
Du coup je me suis lancé dans la rédaction d'[un design doc][design-doc]
pour essayer de préciser la vision et de détourer l'implémentation.

Preneur de vos idées et commentaires dans le doc.

[design-doc]: https://docs.google.com/document/d/1FIZxFKN3PZaeKMifmqbrtq92fWqAh5tWYf2VvsTo-Dw
[dora]: https://dora.dev/
[space]: https://queue.acm.org/detail.cfm?id=3454124
[dx-core-4]: https://getdx.com/research/measuring-developer-productivity-with-the-dx-core-4/
