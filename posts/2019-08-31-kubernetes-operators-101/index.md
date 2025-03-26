---
title: Kubernetes Operators 101
description: "Kubernetes Operators: Why, How, What?"
date: 2019-08-31
---

Kubernetes is highly extensible
and you may already be familiar with some of the [available mechanisms][kube-extension].
This post will introduce you to the [Operator][kube-operator] concept.
Another one will follow with an overview of what’s at your disposal to write one.

This article assumes basic knowledge of Kubernetes' inner workings.
The [official Kubernetes documentation][kube-components]
is a great starting point to learn about these.

## Operators: Off-the-Shelf Managed Services

Operators are extensions to the Kubernetes API
that seek to automate the management of an application.
Like human operators,
Kubernetes operators have deep operational knowledge
and usually handle deployment, scaling, upgrade, as well as recovery from common failures.

> Kubernetes is a platform for building platforms. It's a better place to start; not the endgame.
>
> [Kelsey Hightower](https://twitter.com/kelseyhightower/status/935252923721793536)

Operators empower developers to consume managed services using the Kubernetes API, without the need for administrator intervention. They play a central role when building a self-service [Internal Developer Platforms](https://internaldeveloperplatform.org/) atop Kubernetes.

As an example, the [Strimzi operator](https://strimzi.io) enables provisioning a 5-node Kafka cluster (and its companion Zookeeper) with only a few lines of YAML. Adding a broker and rebalancing partitions is an edit away. Change another line, relax, and watch the operator orchestrate an upgrade to a more recent Kafka version.

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: my-cluster
spec:
  kafka:
    version: 3.6.0
    replicas: 5
    storage:
      type: persistent-claim
      size: 100Gi
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 20Gi
```

<figcaption>
Example Kubernetes manifest defining a Strimzi Kafka cluster.
</figcaption>

A lot of ready-made operators are available on [Artifact Hub](https://artifacthub.io/packages/search?operators=true). Kafka, PostgreSQL, MongoDB, or etcd are all examples of applications for which an operator exists. Be aware that not all of them have truly been battle-tested in production. Likewise, many operators have a major version number of zero (0.y.z) indicating potentially frequent API breaking changes, so use them at your own risk.

With previously unattainable levels of automation now one [`helm install`](https://helm.sh) away, it might be tempting to deploy many operators. There is no such thing as a free lunch however, and confidently supporting the kind of service that Strimzi offers requires strong technical knowledge of not only Kubernetes and Kafka, _but also Strimzi itself_.

It is however sometimes worth writing your own, for instance to address a company-specific need…

## The Operator Pattern: a Robust Automation framework

> If a human operator needs to touch your system during normal operations, you have a bug. The definition of normal changes as your systems grow.
>
> [Carla Geisser](https://sre.google/sre-book/eliminating-toil/)

The operator pattern can be applied to a lot of different use cases and is especially appropriate when dealing with infrastructure-related applications and middleware. Having in mind [SRE](https://landing.google.com/sre/) practices, we are convinced that writing operators (or just controllers as we'll see) will, and should, be considered regular cluster administration to minimize toil.

To this end, multiple tools aiming at simplifying the creation of operators already exist and the landscape is still evolving.

## But what _is_ an operator?

An operator is a mix of Kubernetes extension mechanisms. More precisely, it is the combination of CustomResourceDefinitions, custom controllers and admission webhooks.

### Custom Resources

A resource (both built-in and custom) is an endpoint in the Kubernetes API that stores a collection of API objects of a certain kind. For example, the built-in pods resource endpoint contains a collection of Pod objects.

[Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/) work exactly as core Kubernetes resources (pods, services, deployments, …). The custom objects are stored in etcd and queried through the kube-apiserver (e.g. `kubectl get mycustomresource`).

[CustomResourceDefinitions](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#customresourcedefinitions) are Kubernetes objects enabling you to extend the Kubernetes API by creating new RESTful resource paths on the kube-apiserver. CustomResourceDefinitions also specify an OpenAPI v3.0 validation schema that corresponding CustomResources YAML shall conform to.

In an operator context, CustomResources hold the state (observed and desired) of the service.

By building upon Kubernetes (custom) resources, operators benefit from [common features](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#common-features) like auth/authz, well-defined schema and widely used conventions, as well as a rich tooling ecosystem, e.g. for [configuration management](https://github.com/ndrpnt/awesome-kubernetes-configuration-management).

## Custom controllers

> Controllers are control loop that watch the shared state of the cluster through the API server and make changes attempting to move the current state towards the desired state.
>
> — [Kubernetes documentation](https://kubernetes.io/docs/concepts/architecture/controller/)

Controllers are control loops (i.e. non-terminating reconciliation loops) that continuously watch the state of the cluster, then take actions to move the observed state of the world closer to the desired state. Besides, a controller persists the actual state by updating the status field of the corresponding resource. Custom controllers and built-in Kubernetes controllers (running in the kube-controller-manager) work exactly the same way.

 reconciliation loops
In other words, controllers are non-terminating programs that continuously query the current and desired state of the cluster and then take actions to move the current state closer to the desired state.

Of course the actual implementation has to be smarter, to prevent infinite loops hogging CPU and flooding the API server with requests.

<!-- TODO: edge triggerd but
The reconcilation logic is level-based, as it purposefully ignore _why_ it was triggered and act only in regard to the current and desired state of the universe. However, that reconcilation logic is internally edge-triggered, using the [watch](todo) mechanism, that notifies the controller of any change on objects that the controller is interested in. Controllers also trigger a reconcilation loop over every object they manage at startup and at regular interval afterward ([10 hours by default with controller-runtime](https://github.com/kubernetes-sigs/controller-runtime/blob/637d59fe67c219d09d09289b796dc7bc99272082/pkg/cache/cache.go#L171)). Thus, restarting custom controllers is often useful to force a reconcilation loop.See https://docs.google.com/presentation/d/1ZwFU1-hVVSlsWk0emvMTuIxxhSmOtjD1ztg7mgIsiE8/edit#slide=id.g1819c9ff90d_0_12 for illustations -->

The reconciliation logic is triggered each time a change is made on a watched resource. To watch a resource means subscribing to the kube-apiserver to receive incremental updates. There is usually one controller watching each resource. It is also possible to trigger the reconciliation logic at a regular interval or even, while uncommon, based on events that originate outside of Kubernetes.

The reconciliation code is completely up to the developer. Most commonly it only makes requests to the kube-apiserver, but a controller might as well directly act upon external resources (e.g. call a foreign API, configure a service, …).

An operator is traditionally comprised of multiple controllers, all compiled into a single binary and running in a Pod. Note that “custom controller” and “operator” are often used indiscriminately [^1].

## Admission webhooks

Optionally, and likely packaged in the same binary as the controllers, an operator can include Admission webhooks.

Controllers work to make the current state converge towards the desired one. They are not responsible for determining if the desired state is valid, or receivable. This is where webhooks come into play. They take care of:

* Accepting or rejecting incoming requests (CRUD operations on Kubernetes objects).
* Mutating objects (typically setting defaults) (mutating webhooks).

ValidatingAdmissionWebhooks and MutatingAdmissionWebhooks can run arbitrary code to fulfill their duty, which makes them much more versatile than OpenAPI v3.0 validation schema. Operator authors can embed business logic in a ValidatingAdmissionWebhook that accepts or rejects requests depending on arbitrary conditions.

To illustrate, we can mention how [NGINX Ingress controller](https://github.com/kubernetes/ingress-nginx) validates incoming ingress objects., including NGINX-specific annotations, by exposing a [validating admission webhook server](https://kubernetes.github.io/ingress-nginx/how-it-works/#avoiding-outage-from-wrong-configuration). The ingress controller being a central component, invalid configurations can have unfortunate repercussions on the cluster as a whole.

<!-- https://sequencediagram.org/index.html#initialData=IYYwLg9gTgBARAVQM4FMpxsJMCuqoBQADsFGAJYjkkB2Y8AggAoCSMAymgG5oZaZFyxUhSq0wAcygQcRGAGIUABgBmqlfADyRNMEjoYTCABNhZStWB1GxgLbkkSchBowA6igBGACwgQA1jD4PAb8AO7eZqKW1nAAwi5g0gA2ybyY2OBQyQQoNKYEeGgAtAB8wIIAXDBxUCh6KDAA0sAq-sAEoBRcDQJCFeRlEdUAasDJ5Ma9LW0dXeQ9YI0RnYIAPMXFwwTG9eALvStFUBvFA5U7e929AwSrg6VZydVueiDeza3tnfuLjU8EJ5lc41Oq9dhgBoqHDJThgH7XJZ9QFJZKnc6XeZ-ZFA8pVGAIIhTJEzdpBSFgPAIg5I25PdFVTG-G6CJmI-6ooA -->

{% image "kubernetes-operator_strimzi-sequence-diagram.png", "Sequence diagram describing how the aforementioned Strimzi operator (conceptually) reacts when a developper requests the creation of a Kafka cluster" %}

<!-- "How the aforementioned Strimzi operator (conceptually) reacts when a developper requests the creation of a Kafka cluster. Note that this diagram is technically wrong and only serves to illustrate the point." -->

## Who writes an operator?

> Developing an operator is the type of project DevOps is all about. Ops improve their coding skills while developers dig deeper into the Ops black magic.
>
> – Arnaud MAZIN

Keeping control of the code is a major challenge; it requires deep knowledge of both Kubernetes and the system that is “operated”. It also requires a healthy software engineering culture (craftsmanship, agile, CI, TDD, …).

While these practices tend to be democratized in Dev teams, they are currently not the rule in all Ops teams, yet. For this very reason, several frameworks reduce or eliminate the need to write code. This of course comes at a price, with limitations on what can be done.

* on détaillera les frameworks dans un article suivant
* C'est compliqué à tester
* Many idiosyncrasies, and footguns when writing controllers

## What's next?

There is still much to be said about the internals of an operator. If you want to learn more, I recommend reading the [Programming Kubernetes](https://www.oreilly.com/library/view/programming-kubernetes/9781492047094) book and writing your own (toy) operators.

[^1]: Like many words, operator had seen it meaning evolve over time, following shifts in technology and marketing. Originally, operators used to describe a collection of CustomResourceDefinitions and controllers that "make it easy to manage complex stateful application". TODO and as Kubernetes-native applications, building on CRD and custom controllers. that make it easy to manage complex **stateful applications** on top of Kubernetes, building on CRD and controllers. KubernetesHistoriquement je crois qu'operator est un terme inventé par coreOS et qui designe "un ensemble de CRD et les controllers associées qui permettent d'opérer une application stateful". C'était une définition restrictive que coreOS/RedHat a ensuite petit à petit élargit, pour construire sur son succès (operatorhub, operator framework, etc). Controller is used to describe both the pattern and a program implementing that pattern. Controllers (the programs) can be custom or part of Kubernetes. Broadly speaking, a controller is any program that start a watch auprès de l'api-server and Ça n'a pas besoin d'être lié à une CRD, tu peux écrire un controller qui injecte un sidecar à tous tes pods par exemple, ou bien qui réplique tous les secret ayant une certaine annotation. Mais bon au fil du temps, les termes deviennent trop petits, sont dilués par les marketeux et aujourd'hui on ne fait plus trop la diff (ce qui n'est pas grave du tout soit dit en passant). The first operator was etcd operator, with the dream of Kubernetes self-managing it's own etcd cluster. The operator was later abandonned as it is so complex to fully autonomously manage an etcd cluster.


[kube-extension]: https://kubernetes.io/docs/concepts/extend-kubernetes/extend-cluster/#extension-points
[kube-operator]: https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
[kube-components]: https://kubernetes.io/docs/concepts/overview/components/
