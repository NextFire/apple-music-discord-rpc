#!/usr/bin/env python3
from pypresence import Presence
import time, os, subprocess

# Initialize RPC
CLIENT_ID = "773825528921849856" # DO NOT CHANGE
RPC = Presence(CLIENT_ID) # Initialize the Presence client

# Constants
APPICON = "appicon" # DO NOT CHANGE
APPICON_DESC = "Apple Music for macOS"

# Return number of Apple Music process running (int)
def music_sessions_as():
    return int(subprocess.run(["osascript",
                "-e", "tell application \"System Events\"",
                "-e", "count (every process whose name is \"Music\")",
                "-e", "end tell"], capture_output=True).stdout.decode('utf-8'))

# Return if Apple Music is "playing", "paused" or "stopped"
# Only works when Apple Music is currently running
def music_state_as():
    return subprocess.run(["osascript",
            "-e", "tell application \"Music\"",
            "-e", "if player state is playing then",
            "-e", "set playerStateText to \"playing\"",
            "-e", "end if",
            "-e", "end tell"], capture_output=True).stdout.decode('utf-8').rstrip()

# Return [name, artist, album, year, duration, player position] of current track
# Only works when Apple Music is currently running
def music_info_as():
    return subprocess.run(["osascript",
            "-e", "tell application \"Music\"",
            "-e", "get {name, artist, album, year, duration} of current track & {player position}",
            "-e", "end tell"], capture_output=True).stdout.decode('utf-8').rstrip().split(", ")

# Return "playing","paused" or "stopped" at each call whenever Apple Music is running or not
def music_state():
    if music_sessions_as() > 0: return music_state_as()
    else: return "stopped"

RPC.connect() # Start the handshake loop
while True: # The presence will stay on as long as the program is running
    state = music_state()
    if state == "playing":
        infos = music_info_as()
        try:
            RPC.update(
            large_image = APPICON,
            large_text = APPICON_DESC,
            small_image = "playing",
            small_text = "Playing『" + infos[0] + "』by " + infos[1] + " (" + infos[3] + ")",
            details = infos[0],
            state = infos[1] + " — " + infos[2] + " (" + infos[3] + ")",
            end = time.time() + float(infos[4]) - float(infos[5]))
        except:
            RPC.update(
            large_image = APPICON,
            large_text = APPICON_DESC,
            small_image = "playing",
            small_text = "Playing",
            details = "Apple Music is playing",
            state = "Details unavailable")
    else:
        RPC.clear()
    time.sleep(15)