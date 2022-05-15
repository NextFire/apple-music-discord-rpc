# apple-music-discord-rpc

**[Deno](https://deno.land) + JavaScript for Automation (JXA) Discord Rich Presence Client for Apple Music on macOS (Catalina and later).**

Works with local tracks and Apple Music streaming service.

## Features

- Flex your music tastes to your online buddies.
- Can be started in background at login.
- Minimalist: No status bar icon clutter and presence only shown when actually playing something.
- Shows album artworks and links to Apple Music (when found) ([#5](https://github.com/NextFire/apple-music-discord-rpc/pull/5)).

<img width="371" alt="image" src="https://user-images.githubusercontent.com/20094890/168470874-5b66dbe5-324c-47e4-a341-3891a24eaed0.png">

## Installation

### Homebrew (recommended)

With [Homebrew](https://brew.sh) installed, simply execute the following commands:

```
brew tap nextfire/tap
brew install apple-music-discord-rpc
brew services restart apple-music-discord-rpc
```

These commands

- adds [my tap](https://github.com/NextFire/homebrew-tap) to Homebrew,
- installs the `apple-music-discord-rpc` formula (and Deno),
- enables the daemon on login and starts it.

The `music-rpc.ts` executable is also added to `PATH`.

### Manually

Instructions archived [here](https://github.com/NextFire/apple-music-discord-rpc/blob/c49e3363c44841f7dfefb41ecdcf42c81fea2ddb/README.md#prerequisites).
