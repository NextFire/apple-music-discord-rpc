# apple-music-discord-rpc

> **Unmaintened old node.js and Python/pypresence versions archived [here](https://github.com/NextFire/apple-music-discord-rpc/tree/node) and [here](https://github.com/NextFire/apple-music-discord-rpc/tree/python).**

**A Deno + JavaScript for Automation (JXA) based Discord Rich Presence client for Apple Music app on macOS.**

Works with both local tracks and Apple Music streaming service!

## Features

- Flex your music tastes to your online buddies
- Can be started in background at login (_daemon mode_ - see below)
- Minimalist: No status bar icon clutter and presence only shown when actually playing something
- Shows album artworks and links to Apple Music (when found) ([#5](https://github.com/NextFire/apple-music-discord-rpc/pull/5))

![](https://media.discordapp.net/attachments/527570331863613440/925854616560742491/collage.png)

## Prerequisites

- macOS Catalina or newer (with Apple Music app)
- [`deno`](https://deno.land)
- Discord, obviously

## Quick start

1. Run the commands below to clone the repo and launch the script with Deno

```bash
git clone https://github.com/NextFire/apple-music-discord-rpc.git
cd apple-music-discord-rpc/
./music-rpc.ts
```

2. Play some music
3. ...
4. Check Discord

### Update

Simply `git pull` and relaunch the script to get the latest changes.

### Daemon mode

#### Install

1. Copy the provided `moe.yuru.music-rpc.plist` to `~/Library/LaunchAgents/` folder (create it if it does not exist)
2. Edit `moe.yuru.music-rpc.plist` with your favorite editor:

a) replace `/absolute/path/to/cloned/repo` with the absolute cloned repo path

b) replace `/absolute/path/to/deno` with the absolute `deno` binary path (given by `which deno`)

3. Run `launchctl load ~/Library/LaunchAgents/moe.yuru.music-rpc.plist`
4. Play some music
5. ...
6. Check Discord

Now the node script will be automatically launched at login.

#### Uninstall

Run these commands:

- `launchctl unload ~/Library/LaunchAgents/moe.yuru.music-rpc.plist`
- `rm ~/Library/LaunchAgents/moe.yuru.music-rpc.plist`

Then delete the cloned repository.

## Known issues

- Apple Music sometimes fails to transmit Apple Music streaming service track informations through AppleScript, [blame Apple](https://github.com/NextFire/apple-music-discord-rpc/issues/4). If it is the case, _Details unavailable_ will be shown on Discord.
