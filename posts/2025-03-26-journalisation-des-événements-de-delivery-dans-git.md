---
title: "[fr] Journalisation des événements de delivery dans Git"
description: |
  Au détour d'une discussion avec un collègue
  sur le calcul de métriques DORA grace à l'historique Git,
  je n'ai pu m'empêcher de généraliser.
  Je me suis dit que beaucoup de données gagneraient à être archivées dans Git.
  Je vous partage mes reflexions en espérant vous inspirer,
  et avoir vos idées et commentaires.
date: 2025-03-26
---

Au détour d'une discussion avec un collègue
sur le calcul de métriques DORA grace à l'historique Git,
je n'ai pu m'empêcher de généraliser.
Je me suis dit que beaucoup de données gagneraient à être archivées dans Git.
Par exemple le résultat des jobs de CI, les déploiements, les incidents, …

Cela aurait pour effet de grandement simplifier
la collecte de métriques de delivery
([DORA][dora], [SPACE][space], [DX Core 4][dx-core-4] & co.),
qui est aujourd'hui contraignante pour un résultat mitigé.
Idéalement tout ça est suffisamment générique,
pour en faire un outil open source
et ouvrir la porte à d'autres cas d'usage.

GitLab, Jira, Prometheus, Kubernetes et autres
nous informent d'événements de delivery dans des formats hétérogènes.
Cela oblige les outils souhaitant consommer ces données
à développer autant d'intégrations qu'il y a de sources.
J'aimerais voir Git servir de "glue".
Je me suis lancé dans la rédaction d'[un design doc][design-doc]
pour préciser la vision et détourer une implémentation.

Preneur de vos idées et commentaires.

[design-doc]: https://docs.google.com/document/d/1c-qi-bbgbEIv_csDR_rBHmKhLMx1uNmpnBfxigeajS0
[dora]: https://dora.dev/
[space]: https://queue.acm.org/detail.cfm?id=3454124
[dx-core-4]: https://getdx.com/research/measuring-developer-productivity-with-the-dx-core-4/
