# apple-music-discord-rpc

**[Deno](https://deno.com) + JavaScript for Automation (JXA) Discord Rich
Presence Client for the macOS Apple Music app (Catalina and later) and legacy
iTunes.**

Works with local tracks and Apple Music streaming service.

## Features

- Can start in background at login
- No status bar icon clutter
- Small and (quite) easy to understand script
- Presence is only enabled when actually playing something
- Apple Music matching
  ([#5](https://github.com/NextFire/apple-music-discord-rpc/pull/5))
- MusicBrainz artwork fallback
  ([#66](https://github.com/NextFire/apple-music-discord-rpc/pull/66))

<img width="230" height="47" alt="image" src="https://github.com/user-attachments/assets/2e168586-4202-46a3-a2d5-0e4e499ecdc6" />
<img width="296" height="128" alt="image" src="https://github.com/user-attachments/assets/d5c01904-d43e-4f10-990d-2c75ff3acc61" />

## Getting Started

Follow one of the two sections below to download the script and enable the macOS
launch agent that will start it at login.

### Homebrew (Recommended)

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
- enable the launch agent and start it immediately.

The `music-rpc.ts` executable is now also in `PATH`.

#### Upgrade

```
brew upgrade apple-music-discord-rpc
brew services restart apple-music-discord-rpc
```

#### Uninstall

```
brew services stop apple-music-discord-rpc
brew remove apple-music-discord-rpc
brew untap nextfire/tap
```

### Shell Scripts

#### Install

Install [Deno](https://deno.com) (v2+), clone the repository and execute
[`install.sh`](/scripts/install.sh):

```
git clone https://github.com/NextFire/apple-music-discord-rpc.git
cd apple-music-discord-rpc/
./scripts/install.sh
```

It will copy the [launch agent](/scripts/moe.yuru.music-rpc.plist) into
`~/Library/LaunchAgents/` and edit it accordingly.

#### Upgrade

```
cd apple-music-discord-rpc/
git fetch && git reset --hard origin/main
./scripts/install.sh
```

#### Uninstall

```
cd apple-music-discord-rpc/
./scripts/uninstall.sh
cd ../
rm -rf apple-music-discord-rpc/
```
