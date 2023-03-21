# apple-music-discord-rpc

**[Deno](https://deno.land) + JavaScript for Automation (JXA) Discord Rich Presence Client for the macOS Apple Music app (Catalina and later) and legacy iTunes.**

Works with local tracks and Apple Music streaming service.

## Features

- Can be started in background at login.
- Minimalist: No status bar icon clutter and presence only shown when actually playing something.
- Shows album artworks and links to Apple Music (when found) ([#5](https://github.com/NextFire/apple-music-discord-rpc/pull/5)).

<img width="370" alt="screenshot" src="https://user-images.githubusercontent.com/20094890/178206934-22134782-c58f-40c0-a6c8-6e27369d9a48.png">

## Usage

Choose one of the two methods below to install the script and enable the launch agent that starts it on login.

### Homebrew

#### Install

After installing [Homebrew](https://brew.sh), execute the following commands:

```
brew tap nextfire/tap
brew install apple-music-discord-rpc
brew services restart apple-music-discord-rpc
```

These commands

- add [this tap](https://github.com/NextFire/homebrew-tap) to Homebrew,
- install its `apple-music-discord-rpc` formula (and Deno),
- enable the launch agent on login and start it.

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
