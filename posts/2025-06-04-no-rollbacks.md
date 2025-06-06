---
title: No Rollbacks
description: No rollbacks
date: 2025-06-04
---

Note that all I'm about to say may not apply if your infrastructure is not driven by (declarative) code.

No rollbacks; always roll-forward, possibly by creating a revert commit
I've yet to see a system with automated (i.e. without human intervention) rollbacks implemented. Granted I'm a newbie, but I just can't even fathon it.
It just seems so brittle. What about schema migrations, data changes, configuration changes, already rolled out replicas vs. unchanged ones.

Given that the desired state of our infrastructure is stored in Git,
why should we add yet another tool to managed rollbacks.
It is just a matter of `git revert`ing a commit for the human-in-the-loop.
It is simple enough that it does not require any level of indiraction, nor any automation.

It is unlikely that deployment happen without a human action (code push, validation, or even actual execution of the deployment procedure). Doing deployment while developpers/ops are asleep sounds ill-advised anyway. Thus, automation of rollback is even less valuable, as it is more likely that human will quickly answer to alerts.

Handling rollbacks any other way imply that our source repository does not match the (desired) state of our infrastructure.
That's because our deployment tool now holds the state of our rollbacks.

More generally no out-of-Git live actions, and no post-merge gates.

For example, shipping a deployment should be a Git action.
If code that is merged on `trunk` has to then be validated in our deployment tool to ship, `trunk` is no longer representative of what's running in production.
Feel free to use whatever tool, and setup whatever gates before one is able to merge on the branche representing the live-state.
Once that's commited on `trunk`, change of mind require another commit.

It should of course be possible to temporarily disengage the Git <-> live infra synchronization mechanism, e.g. to investigate and hotfix an incident.

Biased research mostly confirm that intuition:

* https://octopus.com/blog/automatic-rollbacks-last-resort
