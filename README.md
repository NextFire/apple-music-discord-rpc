# apple-music-discord-rpc

Deno + JavaScript for Automation (JXA) Discord Rich Presence client for the
macOS Apple Music app (Catalina and later) and legacy iTunes.

Works with local tracks and the Apple Music streaming service.

## Features

- Can start in the background at login
- No status bar icon clutter
- Small and (relatively) easy-to-understand script
- Presence is enabled only when music is actually playing
- Apple Music matching
- Local artwork upload on catbox.moe as a fallback

<img width="230" height="47" alt="image" src="https://github.com/user-attachments/assets/2e168586-4202-46a3-a2d5-0e4e499ecdc6" />
<img width="296" height="128" alt="image" src="https://github.com/user-attachments/assets/d5c01904-d43e-4f10-990d-2c75ff3acc61" />

## Getting Started

Follow one of the two methods below to download the script and enable the macOS
launch agent so it starts at login.

### Homebrew (Recommended)

#### Install

After installing [Homebrew](https://brew.sh), run:

```
brew tap nextfire/tap
brew install apple-music-discord-rpc
brew services restart apple-music-discord-rpc
```

These commands add [this tap](https://github.com/NextFire/homebrew-tap) to
Homebrew, install the `apple-music-discord-rpc` formula (and Deno), and enable
the launch agent, starting it immediately.

The `music-rpc.ts` executable is also placed in your `PATH`.

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

Install Deno (v2+), clone the repository, and run `./scripts/install.sh`:

```
git clone https://github.com/NextFire/apple-music-discord-rpc.git
cd apple-music-discord-rpc/
./scripts/install.sh
```

It copies the [launch agent](/scripts/moe.yuru.music-rpc.plist) into
`~/Library/LaunchAgents/` and edits it accordingly.

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
