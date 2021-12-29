# apple-music-discord-rpc

**Unmaintened Python/pypresence version available on the [python branch](https://github.com/NextFire/apple-music-discord-rpc/tree/python).**

> A node.js + JavaScript for Automation (JXA) based Discord Rich Presence client for Apple Music app on macOS.

## Features

- Flex your music tastes to your online buddies
- Can be started in background at login (_daemon mode_ - see below)
- Minimalist: No status bar icon clutter and presence only shown when actually playing something
- Shows album artworks (when found) (https://github.com/NextFire/apple-music-discord-rpc/pull/5)

![](https://media.discordapp.net/attachments/527570331863613440/925854616560742491/collage.png)

## Prerequisites

- macOS Catalina or newer (with Apple Music app)
- [`node`](https://nodejs.dev)
- Discord, obviously

## Usage

First, clone this repository and install node dependancies: `npm install --production`

### Quick use

1. `npm start`
2. Play some music
3. ...
4. Check Discord

### Update

Simply `git pull`, `npm install --production` and relaunch the script to get the latest changes.

### Daemon mode

#### Install

1. Edit provided `moe.yuru.music-rpc.plist` with your favorite editor:

a) replace `/absolute/path/to/cloned/repo` with the absolute cloned repo path

b) replace `/absolute/path/to/node` with the absolute `node` binary path (given by `which node`)

2. Move/Copy `moe.yuru.music-rpc.plist` to `~/Library/LaunchAgents/` folder (create it if it does not exist)
3. Run `launchctl load ~/Library/LaunchAgents/moe.yuru.music-rpc.plist`
4. Play some music
5. ...
6. Check Discord

Now the node script will be automatically launched at login.

#### Uninstall

Run these commands:

- `launchctl unload ~/Library/LaunchAgents/moe.yuru.music-rpc.plist`
- `rm ~/Library/LaunchAgents/moe.yuru.music-rpc.plist`
- `rm ~/Library/LaunchAgents/music-rpc-*.py`

## Known issues

- Apple Music sometimes fails to transmit Apple Music streaming service track informations through AppleScript, [blame Apple](https://github.com/NextFire/apple-music-discord-rpc/issues/4). If it is the case, _Details unavailable_ will be shown on Discord.
