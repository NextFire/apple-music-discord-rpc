#!/usr/bin/env python3

from pypresence import Presence
import time, os, subprocess

# Initialize RPC
client_id = "773825528921849856"  # DO NOT CHANGE
RPC = Presence(client_id)  # Initialize the Presence client
RPC.connect() # Start the handshake loop

# Variables
path = os.path.dirname(os.path.realpath(__file__)) # Path of script directory
music_state_script = path+"/music-state.scpt" # Apple Music state AppleScript location
music_info_script = path+"/music-info.scpt" # Apple Music proprieties AppleScript location

# state = "playing","paused" or "stopped" at each call
def music_state():
    # Count Apple Music instances
    count = int(subprocess.check_output(["osascript",
                "-e", "tell application \"System Events\"",
                "-e", "count (every process whose name is \"Music\")",
                "-e", "end tell"]).strip())
    global state
    # If Apple Music is open, check player state
    if count > 0 : state = subprocess.run(["osascript", music_state_script], capture_output=True).stdout.decode('utf-8').rstrip()
    else: state = "stopped"

while True:  # The presence will stay on as long as the program is running
    music_state()
    # If music is playing, connect to RPC
    if state=="playing" :
        RPC.connect()
        # Update card while still playing music
        while state=="playing":
            infos = subprocess.run(["osascript", music_info_script], capture_output=True).stdout.decode('utf-8').rstrip().split(", ")
            RPC.update(
            large_image = "appicon", # DO NOT CHANGE
            large_text = "Apple Music (macOS)",
            small_image = state, # DO NOT CHANGE
            small_text = "Listening " + infos[0] + " by " + infos[1] + " from " + infos[2] + " (" + infos[3] + ")",
            details = infos[0],
            state = infos[1] + " — " + infos[2] + " (" + infos[3] + ")",
            end = time.time() + float(infos[4]) - float(infos[5]))
            time.sleep(15)
            music_state()
        # Music stopped, close connection
        RPC.close()
    time.sleep(15)