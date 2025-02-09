---
title: TODO
description: "Kubernetes Operators: Why, How, What?"
date: 2019-08-31
---

## Custom controllers

Of course the actual implementation has to be smarter, to prevent infinite loops hogging CPU and flooding the API server with requests.

<!-- TODO: edge triggerd but
The reconcilation logic is level-based, as it purposefully ignore _why_ it was triggered and act only in regard to the current and desired state of the universe. However, that reconcilation logic is internally edge-triggered, using the [watch](todo) mechanism, that notifies the controller of any change on objects that the controller is interested in. Controllers also trigger a reconcilation loop over every object they manage at startup and at regular interval afterward ([10 hours by default with controller-runtime](https://github.com/kubernetes-sigs/controller-runtime/blob/637d59fe67c219d09d09289b796dc7bc99272082/pkg/cache/cache.go#L171)). Thus, restarting custom controllers is often useful to force a reconcilation loop.See https://docs.google.com/presentation/d/1ZwFU1-hVVSlsWk0emvMTuIxxhSmOtjD1ztg7mgIsiE8/edit#slide=id.g1819c9ff90d_0_12 for illustations -->

The reconciliation logic is triggered each time a change is made on a watched resource. To watch a resource means subscribing to the kube-apiserver to receive incremental updates. There is usually one controller watching each resource. It is also possible to trigger the reconciliation logic at a regular interval or even, while uncommon, based on events that originate outside of Kubernetes.

The reconciliation code is completely up to the developer. Most commonly it only makes requests to the kube-apiserver, but a controller might as well directly act upon external resources (e.g. call a foreign API, configure a service, …).

An operator is traditionally comprised of multiple controllers, all compiled into a single binary and running in a Pod. Note that “custom controller” and “operator” are often used indiscriminately [^1].

## What else?

To be considered production ready, like any software, operators must:

* **Expose metrics**: both standard ones (depending on its programming language) and specific ones, describing its internal behavior: events queue size, successful/unsuccessful reconciliations… Usually, the [OpenMetrics](https://openmetrics.io/) format (also known as the Prometheus format) is used.
* **Embed a liveness probe** to ensure that the controller is working correctly or restarted in case of failure.
* **Embed a readiness probe** although not strictly required as operators do not expose a regular service. With that said, they make sense for operators exposing admission webhooks.
* **Log enough information** to aid troubleshooting.
* **Be given _only_ the needed permissions** through Kubernetes RBAC.
* **Be packaged**. There is a plethora of options here, be it Helm, Kustomize, kapp or the [OLM](https://github.com/operator-framework/operator-lifecycle-manager), among others.

## Choosing the right tool(s)

### Why does it matter?

Operators extend a bare Kubernetes cluster with new functionalities that add technical or business value. They are not trivial to develop nor to maintain, thus the initial choice of tools (language, framework, SDK, …) is crucial.

An operator may be written in any language, as long as it can query the kube-apiserver. Libraries offer abstractions to perform common tasks. This is usually limited to a client to query the kube-apiserver, meaning the rest must be written from scratch. Frameworks also dictate the reconciliation flow and handle the underlying plumbing, thus enabling developers to focus on the business logic. A few even offer the aforementioned “production ready” requirements out of the box.

Testability is another important–and often overlooked–criteria when selecting a tool. As operators are inherently distributed and asynchronous, testing them is not straightforward. Some frameworks offer testing facilities while others don’t. You may have an even harder time testing your operator, should you choose to not write it in an imperative language.

Finally, community and adoption should also be considered when picking a tool. You want to make sure that your dependencies are somewhat mature and will be maintained in the foreseeable future. Currently, the most mature tools are written in golang. Choosing other tools may expose you to quirks, limitations and a lack of examples.

## Available tools

Following is a list of tools to ease the writing of controllers (and more). Depending on your criteria (programming language, purpose, technical features needed, inner logic simplicity…), you will likely want to choose one.

SDKs and frameworks have an opinion on how to build an operator and also greatly reduce the boilerplate needed to write one. Libraries are mentioned for completeness but will likely be embedded in the SDK/framework of your choice.

### SDKs & frameworks

The standard choice for writing controllers in Go is either the [Operator SDK](https://github.com/operator-framework/operator-sdk) or [Kubebuilder](https://github.com/kubernetes-sigs/kubebuilder). The two tools have converged to the point that they mostly rely on the same codebase and differ only in the structure of the scaffolded project.

The Operator SDK additionally supports Ansible and Helm operators and integrates with the rest of the [Operator framework](https://github.com/operator-framework), mainly the [operator lifecycle manager](https://github.com/operator-framework/operator-lifecycle-manager). On the other hand, Kubebuilder has better support for admission webhooks.

With that said, it might be a wiser choice to go with Kubebuilder, as Operator SDK’s features are [set to be upstreamed](https://github.com/kubernetes-sigs/kubebuilder/blob/master/designs/integrating-kubebuilder-and-osdk.md) into Kubebuilder. We think that Kubebuilder is becoming the linchpin tool for writing operators and that some projects that were once standalone, will turn into Kubebuilder [plugins](https://github.com/kubernetes-sigs/kubebuilder/pull/943).

[sample-controller](https://github.com/kubernetes/sample-controller/) is not a framework per se but rather a reference implementation. It is an example of how to build a controller with a single type that is implemented exactly like a built-in Kubernetes controller. While not officialy deprecated, sample-controller is now superseded by controller-runtime.

[KUDO](https://github.com/kudobuilder/kudo) (Kubernetes Universal Declarative Operator) operators are a series of Kubernetes manifests with some simple built-in logic. KUDO is highly opinionated and requires no coding. It seems to focus on cases that solely require synchronization between a CustomResource and a (set of) Kubernetes resource(s), e.g. distributed stateful application.

[Metacontroller](https://github.com/metacontroller/metacontroller) is itself an operator. It calls custom code (written in any language), passing it JSON describing the observed state and expecting JSON describing the desired state to be returned. This is all done in a “pure” (in the functional programming sense) way.

Note that the project is currently unmaintained. Although there is [interest in taking over maintenance](https://github.com/GoogleCloudPlatform/metacontroller/issues/184), it might not be a good idea to use it for now.

[Kopf](https://github.com/nolar/kopf) (Kubernetes Operator Pythonic Framework) is a framework to make Kubernetes operators in Python. It is easy to get going with just a few lines of code and remains flexible, as arbitrary code can be executed. However, the reconciliation logic is different from the Go frameworks (and seems less resilient overall). Kopf relies on annotations to track watched objects (therefore requiring write permissions on them) and does not seem to implement a caching mechanism for reading objects from the API server, which could impact performance.

The [Rook](https://github.com/rook/rook) framework provides components for writing storage-related operators like software-defined storage solutions or (distributed) databases. Rook helps with common tasks like disks and directories discovery, and provides a consistent experience for the users.

[Shell-operator](https://github.com/flant/shell-operator) is a tool for running event-driven scripts in a Kubernetes cluster. It provides an integration layer between Kubernetes cluster events and shell scripts by treating scripts as hooks triggered by events. The scripts then commonly issue `kubectl` commands.

[Krator](https://github.com/krator-rs/krator)

[Mast](https://gitlab.com/ansi-services/mast)

SDKs are available for numerous languages, e.g. [Elixir](https://github.com/coryodaniel/bonny), [.NET](https://github.com/buehler/dotnet-operator-sdk), [Java](https://github.com/java-operator-sdk/java-operator-sdk), [Rust](https://github.com/kube-rs/kube)

[Achilles SDK](https://github.com/reddit/achilles-sdk), opinionated, build reconcilers in the form of FSM, provides logging, metrics, rate-limiting, etc. out of the box.

[Reconciler.io](https://github.com/reconcilerio/runtime), opinionated framework built on controller-runtime. Strong focus on unit testing.

### Libraries

[Client-go](https://github.com/kubernetes/client-go) is the official Go Kubernetes client. It is used in sample-controller and Kubernetes core. It implements a caching mechanism, which drastically reduces direct reads from the kube-apiserver.

[Other clients](https://github.com/kubernetes-client) exist in several languages, although none is as complete as the Go implementation. Maturity can vary greatly from one client to another. In general, it is a good practice to read from a cache, which has to be manually implemented in most non-Go clients.

[controller-runtime](https://github.com/kubernetes-sigs/controller-runtime/) is a set of Go libraries for building custom controllers. It is the API you will be interacting with when coding a controller with the Operator SDK or Kubebuilder (reconciliation loop, client, testing, …).

controller-runtime also instruments several key metrics related to controllers and webhooks and makes them available via HTTP endpoint in prometheus metric format. At the time of writing, liveness and readiness probes are still a [work in progress](https://github.com/kubernetes-sigs/controller-runtime/pull/419).

[Controller-tools](https://github.com/kubernetes-sigs/controller-tools) is used by both the Operator SDK and Kubebuilder internally, to scaffold and generate code.

The [operator-kit](https://github.com/rook/operator-kit) library was originally extracted from the Rook framework, and is now deprecated in favor of controller-runtime.

### Testing (?)

* [KUTTL](https://github.com/kudobuilder/kuttl)
* [Chainsaw](https://github.com/kyverno/chainsaw)
* [test-infra](https://github.com/kubernetes/test-infra)
* [E2E Framework](https://github.com/kubernetes-sigs/e2e-framework)
* [Sieve](https://github.com/sieve-project/sieve)
* [Acto](https://github.com/xlab-uiuc/acto)

# Conclusion

An operator is a tool to help you turn an application into a self-service offering for your users.

For operators involving trivial reconciliation logic, all the above-mentioned solutions are viable, including the ones involving less coding (like shell-operator, operator SDK Helm/Ansible, and KUDO).

As complexity increases, consider switching to a fully-fledged programming language. Go is the safest option with multiple tried and tested projects, while other languages are catching up but do not come without their drawbacks.

# What's next?

<!-- TODO: talk about https://github.com/kcp-dev/kcp ? -->

There is still much to be said about the internals of an operator. If you want to learn more, I recommend reading the [Programming Kubernetes](https://www.oreilly.com/library/view/programming-kubernetes/9781492047094) book and writing your own (toy) operators.

[^1]: Like many words, operator had seen it meaning evolve over time, following shifts in technology and marketing. Originally, operators used to describe a collection of CustomResourceDefinitions and controllers that "make it easy to manage complex stateful application". TODO and as Kubernetes-native applications, building on CRD and custom controllers. that make it easy to manage complex **stateful applications** on top of Kubernetes, building on CRD and controllers. KubernetesHistoriquement je crois qu'operator est un terme inventé par coreOS et qui designe "un ensemble de CRD et les controllers associées qui permettent d'opérer une application stateful". C'était une définition restrictive que coreOS/RedHat a ensuite petit à petit élargit, pour construire sur son succès (operatorhub, operator framework, etc). Controller is used to describe both the pattern and a program implementing that pattern. Controllers (the programs) can be custom or part of Kubernetes. Broadly speaking, a controller is any program that start a watch auprès de l'api-server and Ça n'a pas besoin d'être lié à une CRD, tu peux écrire un controller qui injecte un sidecar à tous tes pods par exemple, ou bien qui réplique tous les secret ayant une certaine annotation. Mais bon au fil du temps, les termes deviennent trop petits, sont dilués par les marketeux et aujourd'hui on ne fait plus trop la diff (ce qui n'est pas grave du tout soit dit en passant). The first operator was etcd operator, with the dream of Kubernetes self-managing it's own etcd cluster. The operator was later abandonned as it is so complex to fully autonomously manage an etcd cluster.
