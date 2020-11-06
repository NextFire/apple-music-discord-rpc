#!/usr/bin/env python3

from pypresence import Presence
import time, os, subprocess

# Initialize RPC
client_id = "773825528921849856"  # DO NOT CHANGE
RPC = Presence(client_id)  # Initialize the Presence client
RPC.connect() # Start the handshake loop

# Variables
path = os.path.dirname(os.path.realpath(__file__)) # Path of script directory
music_state = path+"/music-state.scpt" # Apple Music state AppleScript location
music_info = path+"/music-info.scpt" # Apple Music proprieties AppleScript location
appicon = "appicon" # DO NOT CHANGE
appicon_desc = "Apple Music (macOS)"

while True:  # The presence will stay on as long as the program is running
    state = subprocess.run(["osascript", music_state], capture_output=True).stdout.decode('utf-8').rstrip()
        # Returns "playing", "paused" or "stopped"
    if state=="playing":
        infos = subprocess.run(["osascript", music_info], capture_output=True).stdout.decode('utf-8').rstrip().split(", ")
            # Returns [name, artist, album, year, duration of current track, player position]
        RPC.update(
        large_image = appicon,
        large_text = appicon_desc,
        small_image = state, # DO NOT CHANGE
        small_text = "Listening " + infos[0] + " by " + infos[1] + " from " + infos[2] + " (" + infos[3] + ")",
        details = infos[0],
        state = infos[1] + " — " + infos[2] + " (" + infos[3] + ")",
        end = time.time() + float(infos[4]) - float(infos[5]))
    elif state=="paused":
        infos = subprocess.run(["osascript", music_info], capture_output=True).stdout.decode('utf-8').rstrip().split(", ")
            # Returns [name, artist, album, year, duration of current track, player position]
        RPC.update(
        large_image = appicon,
        large_text = appicon_desc,
        small_image = state, # DO NOT CHANGE
        small_text = "Paused " + infos[0] + " by " + infos[1] + " from " + infos[2] + " (" + infos[3] + ")",
        details = infos[0],
        state = infos[1] + " — " + infos[2] + " (" + infos[3] + ")")
    else:
        RPC.update(
        large_image = appicon,
        large_text = appicon_desc,
        small_image = state, # DO NOT CHANGE
        small_text = state.capitalize(),
        details = "Nothing is played.")
    time.sleep(15)