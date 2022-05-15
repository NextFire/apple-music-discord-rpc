#!/bin/bash

launchctl unload ~/Library/LaunchAgents/moe.yuru.music-rpc.plist
rm ~/Library/LaunchAgents/moe.yuru.music-rpc.plist && \
echo \> Successfully removed launch agent
