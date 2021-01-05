# apple-music-discord-rpc
> A Python3/pypresence + AppleScript based Discord Rich Presence client for Apple Music app on macOS (works for both local tracks and Apple Music streaming service)

## Features
* Flex your music tastes to your online buddies
* **Can work when music is playing/paused/stopped (`music-rpc-full.py`) or only when it is playing (`music-rpc-mini.py`)**
* Can be launched in background at startup (*daemon mode* - see below)
* No status bar icon clutter
* Simple: only one short and easy to understand Python file to launch and only one external module required (`pypresence`) as it uses macOS system automation tools already installed on your Mac.

![](https://cdn.discordapp.com/attachments/527570331863613440/790922602926833694/Capture_decran_2020-12-22_a_13.43.56.png)

## Prerequisites
* macOS Catalina or newer (with Apple Music app)
* `python3` and `pypresence` module (`pip3 install pypresence`)
* Discord, obviously

## Usage
0) Clone repository
### Quick use
1) Run `python3 music-rpc-full.py` or `python3 music-rpc-mini.py` (see above for difference)
2) Play some music
3) ...
4) Check Discord

### Daemon mode
#### Install
1) Edit provided `moe.nichijou.music-rpc.plist` with your favorite editor:

a) replace `path/to/python3` with absolute `python3` binary path (given by `which python3`)

b) replace `path/to/music-rpc-.py` with absolute `music-rpc-full.py` or `music-rpc-full.py` path (alt+rightclick preferred `.py` in Finder to easily copy path)

2) Move/Copy `moe.nichijou.music-rpc.plist` to `~/Library/LaunchAgents/` folder (create it if not already)
3) Run `launchctl load ~/Library/LaunchAgents/moe.nichijou.music-rpc.plist`
4) Play some music
5) ...
6) Check Discord

Now the Python script will be launched automatically at startup.

#### Uninstall
Run these commands:
* `launchctl unload ~/Library/LaunchAgents/moe.nichijou.music-rpc.plist`
* `rm ~/Library/LaunchAgents/moe.nichijou.music-rpc.plist`
* `rm ~/Library/LaunchAgents/music-rpc-*.py`
