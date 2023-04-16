#!/bin/sh -xe
echo --- Unload launch agent
launchctl unload ~/Library/LaunchAgents/moe.yuru.music-rpc.plist
echo --- Remove launch agent plist
rm -f ~/Library/LaunchAgents/moe.yuru.music-rpc.plist || true
echo --- UNINSTALL SUCCESS
