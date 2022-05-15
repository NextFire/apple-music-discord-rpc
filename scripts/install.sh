#!/bin/bash

cd "$(dirname "$0")"
cd ..

./scripts/uninstall.sh

mkdir ~/Library/LaunchAgents/
cp scripts/moe.yuru.music-rpc.plist ~/Library/LaunchAgents/ && \
plutil -replace WorkingDirectory -string "$(pwd)" ~/Library/LaunchAgents/moe.yuru.music-rpc.plist && \
echo \> Installed launch agent at ~/Library/LaunchAgents/moe.yuru.music-rpc.plist

launchctl load ~/Library/LaunchAgents/moe.yuru.music-rpc.plist && \
echo \> Successfully loaded launch agent
