# apple-music-discord-rpc

**[Deno](https://deno.land) + JavaScript for Automation (JXA) Discord Rich Presence Client for the macOS Apple Music app (Catalina and later) and legacy iTunes.**

Works with local tracks and Apple Music streaming service.

## Features

- Can be started in background at login.
- Minimalist: No status bar icon clutter and presence only shown when actually playing something.
- Shows album artworks and links to Apple Music (when found) ([#5](https://github.com/NextFire/apple-music-discord-rpc/pull/5)).

<img width="371" alt="image" src="https://user-images.githubusercontent.com/20094890/168470874-5b66dbe5-324c-47e4-a341-3891a24eaed0.png">

## Usage

Choose one of the two methods below to download the script and enable the launch agent that starts the script on login.

### Homebrew

#### Install

With [Homebrew](https://brew.sh) installed, simply execute the following commands:

```
brew tap nextfire/tap
brew install apple-music-discord-rpc
brew services restart apple-music-discord-rpc
```

These commands

- adds [my tap](https://github.com/NextFire/homebrew-tap) to Homebrew,
- installs the `apple-music-discord-rpc` formula (and Deno),
- enables the launch agent on login and starts it.

The `music-rpc.ts` executable is also added to `PATH`.

#### Uninstall

```
brew services stop apple-music-discord-rpc
brew remove apple-music-discord-rpc
brew untap nextfire/tap
```

### Scripts

#### Install

Install [Deno](https://deno.land) then clone the repository and execute [`install.sh`](/scripts/install.sh):

```
git clone https://github.com/NextFire/apple-music-discord-rpc.git
cd apple-music-discord-rpc/
./scripts/install.sh
```

It will copy the [launch agent](/scripts/moe.yuru.music-rpc.plist) into `~/Library/LaunchAgents/` and correctly edit it.

#### Uninstall

```
cd apple-music-discord-rpc/
./scripts/uninstall.sh
cd ../
rm -rf apple-music-discord-rpc/
```
