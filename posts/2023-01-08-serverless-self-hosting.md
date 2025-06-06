---
title: Serverless Self-hosting
description: Serverless Self-hosting
date: 2023-01-08
---

- My gut feeling tells me that requiring to self host a backend reduces potential user base by one or two orders of magnitude
- Most of the time, the downsides (limited functionalities, slowness, sporadic/asynchronous saves, more complex client code) do not justify losing a large portion of its users
- Open source projects should reason in terms of a client-only product, and only …
- Open source project authors/maintainers are not their average users. Nor should they strive to be. Give a simple tool to a developer, you save them time. Give the same tool to a non-technical user, you expose them to new capabilities. Thus by lowering the barrier to entry, you don't just gain users, you increase impact.
- The barrier to entry, real or perceived, is the deciding factor for adoption. (path of least resistance)
- Embed [SQLite3 WASM](https://sqlite.org/wasm/doc/trunk/index.md) in your webapp and maybe rely on [VFS](https://www.sqlite.org/vfs.html) to store the database somewhere
  - Local file, s3, Google Drive, git repository,
  - Basically [anything supported by rclone](https://rclone.org/docs/#configure) can be used as a storage backend for a client-only software
- By imposing this constraint on themselves, I feel like most application would only be marginally affected. Sacrificing some functionalities, accepting different tradeoffs, slightly worse performance and UX. But overall the same utility. However they'd be orders of magnitude easier to adopt.
  - Self-hosting is rather niche. I think that the public could be much larger if the ease of adoption was an important "feature" of these applications.
  - The difference between "rent a VPS and run `docker compose up`" and "browse to this page and click sign up with Google" is day and night, even for technical users. I personally can't be arsed setting up a homelab. But I'd easily adopt a stateless application in front of some HTTP storage.
- Some kind of sharing may be implemented by encrypting resources with different key pairs.
- Multiplayer/live collaboration may be implement using WebRTC and an S3 bucket for signaling ? (not sure, I've never used these)
- Maybe [S3 Select](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-select-sql-reference-select.html) would be useful. Update, that would now be Apache Iceberg. Also [OpenDAL](https://github.com/apache/opendal/)
- Makes me think that S3 lacks a notification (via webhook, websocket, SSE whatever) feature. On AWS (and other cloud provider do the same) it requires using another service like SNS or SQS

Random examples (note that I have no experience with many of these tools, so this architecture might not make sense for all of them. But I think it generally make sense for that kind of tools. They also have built functionnalities that would not be practical to implement without a server, and haven't been optimized to run only client-side. I'd argue that it's not what make their core value:

- [Vaultwarden](https://github.com/dani-garcia/vaultwarden), and other password managers;
- [Money Manager Ex](https://github.com/moneymanagerex/moneymanagerex), and other personnal finances
- [Vikunja](https://github.com/go-vikunja/vikunja), and other todo apps
- [Jellyfin](https://github.com/jellyfin/jellyfin), and other media systems
- [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx), and other personnal document management systems
- [Immich](https://github.com/immich-app/immich)
- [Atuin](https://atuin.sh/)'s backend
- [Linkwarden](https://github.com/linkwarden/linkwarden)
- [Omnivore](https://github.com/omnivore-app/omnivore)
- [Paisa](https://github.com/ananthakumaran/paisa)
- [FreshRSS](https://github.com/FreshRSS/FreshRSS)
- [Ente](https://github.com/ente-io/ente)
- [Black Candy](https://github.com/blackcandy-org/blackcandy)
- [Mealie](https://github.com/mealie-recipes/mealie)
- [ArchiveBox](https://github.com/ArchiveBox/ArchiveBox)
- [Maybe](https://github.com/maybe-finance/maybe)
- [Nextcloud](https://github.com/nextcloud/all-in-one), [ownCloud](https://github.com/owncloud/core), [OxiCloud](https://github.com/DioCrafts/OxiCloud), and other cloud / drive services

By embracing the constraint of requiring no more than HTTP storage,
we can find ways for many applications to work within this limit
without sacrificing too much in terms of functionality or ergonomy.
