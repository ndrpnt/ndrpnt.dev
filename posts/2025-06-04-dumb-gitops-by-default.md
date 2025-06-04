---
title: Dumb GitOps by default
description: \"Dumb" GitOps should be the default deployment method for Kubernetes application
date: 2025-06-04
---

* If you distribute a Kubernetes application, it should be the default documented installation method.
* If it is hard to support, e.g. because of bootstrapping, or the need to `kubectl exec` something, you may want to: write a controller, or maybe add some dependencies (how to express them in a clean way ?)
  * Deployment logic should live in controllers. Either specific to the application, or generic ones that your application depends on, e.g. kro
* Dumb means no orchestration, non-deterministic ordering, SSA-only. Merely retry until every resource could be applied
* It is more constraining than other methods; if an application supports it, it supports most other deployment methods
* It is robust, maintainable, simple to reason about, scales, etc.
* This imply that an higher-level resource is deployed via GitOps. Instead of intelligently deploying low-level resources, one should dumbly deploy a higher-level resource
* It includes installing CRDs
* Some exceptions: specifying certificates in webho
* Exemple of bad distribution of an application: a custom CLI/`kubectl` plugin, a README with steps following a `kubectl apply` (e.g. `kubectl exec`), a Helm Chart with hooks, a Helm Chart that does not converge
