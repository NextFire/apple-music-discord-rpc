#!/usr/bin/env python3
from pypresence import Presence
import subprocess
import time


# Initialize RPC
CLIENT_ID = '773825528921849856'  # DO NOT CHANGE
RPC = Presence(CLIENT_ID)  # Initialize the Presence client

# Constants
APPICON = 'appicon'  # DO NOT CHANGE
APPICON_DESC = 'Apple Music for macOS'


# Return number of Apple Music process running (int)
def music_sessions_as():
    return int(
        subprocess.run(
            [
                "osascript",
                "-e",
                "tell application \"System Events\"",
                "-e",
                "count (every process whose name is \"Music\")",
                "-e",
                "end tell",
            ],
            capture_output=True,
            text=True,
        ).stdout
    )


# Return if Apple Music is 'playing', 'paused' or 'stopped'
# Only works when Apple Music is currently running
def music_state_as():
    return subprocess.run(
        [
            "osascript",
            "-e",
            "tell application \"Music\"",
            "-e",
            "if player state is playing then",
            "-e",
            "set playerStateText to \"playing\"",
            "-e",
            "else if player state is paused then",
            "-e",
            "set playerStateText to \"paused\"",
            "-e",
            "else",
            "-e",
            "set playerStateText to \"stopped\"",
            "-e",
            "end if",
            "-e",
            "end tell",
        ],
        capture_output=True,
        text=True,
    ).stdout.rstrip()


# Return [name, artist, album, year, duration, player position] of current track
# Only works when Apple Music is currently running
def music_info_as():
    return (
        subprocess.run(
            [
                "osascript",
                "-e",
                "tell application \"Music\"",
                "-e",
                "get {name, artist, album, year, duration} of current track & {player position}",
                "-e",
                "end tell",
            ],
            capture_output=True,
            text=True,
        )
        .stdout.rstrip()
        .split(', ')
    )


# Return 'playing', 'paused' or 'stopped' at each call whenever Apple Music is running or not
def music_state():
    return music_state_as() if music_sessions_as() else 'stopped'


# Start the handshake loop
RPC.connect()
# The presence will stay on as long as the program is running
while True:
    state = music_state()

    if state in ('playing', 'paused'):
        infos = music_info_as()
        try:
            RPC.update(
                large_image=APPICON,
                large_text=APPICON_DESC,
                small_image=state,
                small_text=f'{state.capitalize()}『{infos[0]}』by {infos[1]}'
                + (f' ({infos[3]})' if infos[3] != '0' else ''),
                details=infos[0],
                state=f'{infos[1]} — {infos[2]}'
                + (f' ({infos[3]})' if infos[3] != '0' else ''),
                end=time.time() + float(infos[4]) - float(infos[5])
                if state == 'playing'
                else None,
            )
        except IndexError:
            RPC.update(
                large_image=APPICON,
                large_text=APPICON_DESC,
                small_image=state,
                small_text=state.capitalize(),
                details=f'Apple Music is {state}',
                state='Details unavailable',
            )

    else:
        RPC.update(
            large_image=APPICON,
            large_text=APPICON_DESC,
            small_image='stopped',
            small_text='Stopped',
            details='Apple Music is stopped',
        )

    time.sleep(15)
