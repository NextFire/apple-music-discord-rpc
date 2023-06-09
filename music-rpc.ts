#!/usr/bin/env deno run --unstable --allow-env --allow-run --allow-net --allow-read --allow-write --allow-ffi

import type { Activity } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import { Client } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import type {} from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/global.d.ts";
import { run } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/mod.ts";
import type { iTunes } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/types/core.d.ts";

// Main part

const MACOS_VER = await getMacOSVersion();
const IS_APPLE_MUSIC = MACOS_VER >= 10.15;
const APP_NAME: iTunesAppName = IS_APPLE_MUSIC ? "Music" : "iTunes";
const CLIENT_ID = IS_APPLE_MUSIC ? "773825528921849856" : "979297966739300416";

const KV = await Deno.openKv("kv.sqlite3");
const CACHE_VERSION = 1;
main();

async function main() {
  try {
    const rpc = new Client({ id: CLIENT_ID });
    await rpc.connect();
    console.log(rpc);
    const timer = setInterval(async () => {
      try {
        await setActivity(rpc);
      } catch (err) {
        console.error(err);
        clearInterval(timer);
        rpc.close();
        main();
      }
    }, 15e3);
  } catch (err) {
    console.error(err);
    setTimeout(main, 15e3);
  }
}

// macOS/JXA functions

async function getMacOSVersion(): Promise<number> {
  const cmd = new Deno.Command("sw_vers", { args: ["-productVersion"] });
  const output = await cmd.output();
  const decoded = new TextDecoder().decode(output.stdout);
  const version = parseFloat(decoded.match(/\d+\.\d+/)![0]);
  return version;
}

function isOpen(): Promise<boolean> {
  return run((appName: iTunesAppName) => {
    return Application("System Events").processes[appName].exists();
  }, APP_NAME);
}

function getState(): Promise<string> {
  return run((appName: iTunesAppName) => {
    const music = Application(appName) as unknown as iTunes;
    return music.playerState();
  }, APP_NAME);
}

function getProps(): Promise<iTunesProps> {
  return run((appName: iTunesAppName) => {
    const music = Application(appName) as unknown as iTunes;
    return {
      ...music.currentTrack().properties(),
      playerPosition: music.playerPosition(),
    };
  }, APP_NAME);
}

// iTunes Search API

async function iTunesSearch(props: iTunesProps): Promise<iTunesInfos> {
  const { name, artist, album } = props;
  const key = [name, artist, album];
  const cached = await KV.get<{ version: number; infos: iTunesInfos }>(key);

  let infos: iTunesInfos;
  if (cached.value?.version === CACHE_VERSION) {
    infos = cached.value.infos;
  } else {
    infos = await _iTunesSearch(name, artist, album);
    KV.set(key, { version: CACHE_VERSION, infos });
  }

  return infos;
}

async function _iTunesSearch(
  song: string,
  artist: string,
  album: string
): Promise<iTunesInfos> {
  // Asterisks tend to result in no songs found, and songs are usually able to be found without it
  const query = `${song} ${artist} ${album}`.replace("*", "");
  const params = new URLSearchParams({
    media: "music",
    entity: "song",
    term: query,
  });
  const resp = await fetch(`https://itunes.apple.com/search?${params}`);
  const json: iTunesSearchResponse = await resp.json();

  let result: iTunesSearchResult | undefined;
  if (json.resultCount === 1) {
    result = json.results[0];
  } else if (json.resultCount > 1) {
    // If there are multiple results, find the right album
    // Use includes as imported songs may format it differently
    // Also put them all to lowercase in case of differing capitalisation
    result = json.results.find(
      (r) =>
        r.collectionName.toLowerCase().includes(album.toLowerCase()) &&
        r.trackName.toLowerCase().includes(song.toLowerCase())
    );
  } else if (album.match(/\(.*\)$/)) {
    // If there are no results, try to remove the part
    // of the album name in parentheses (e.g. "Album (Deluxe Edition)")
    return await _iTunesSearch(
      song,
      artist,
      album.replace(/\(.*\)$/, "").trim()
    );
  }

  const artwork = result?.artworkUrl100 ?? null;
  const url = result?.trackViewUrl ?? null;
  return { artwork, url };
}

// Activity setter

async function setActivity(rpc: Client) {
  const open = await isOpen();
  console.log("isOpen:", open);

  if (!open) {
    await rpc.clearActivity();
    return;
  }

  const state = await getState();
  console.log("state:", state);

  switch (state) {
    case "playing": {
      const props = await getProps();
      console.log("props:", props);

      let end;
      if (props.duration) {
        const delta = (props.duration - props.playerPosition) * 1000;
        end = Math.ceil(Date.now() + delta);
      }

      // EVERYTHING must be less than or equal to 128 chars long
      const activity: Activity = {
        details: formatStr(props.name),
        timestamps: { end },
        assets: { large_image: "appicon" },
      };

      if (props.artist.length > 0) {
        activity.state = formatStr(props.artist);
      }

      const query = `artist:${props.artist} track:${props.name}`;
      activity.buttons = [
        {
          label: "Search on Spotify",
          url: encodeURI(`https://open.spotify.com/search/${query}?si`),
        },
      ];

      // album.length == 0 for radios
      if (props.album.length > 0) {
        const infos = await iTunesSearch(props);
        console.log("infos:", infos);

        activity.assets = {
          large_image: infos.artwork ?? "appicon",
          large_text: formatStr(props.album),
        };

        if (infos.url) {
          activity.buttons.unshift({
            label: "Play on Apple Music",
            url: infos.url,
          });
        }
      }

      await rpc.setActivity(activity);
      break;
    }

    case "paused":
    case "stopped": {
      await rpc.clearActivity();
      break;
    }
  }
}

/**
 * Format string to specified char limits.
 * Will output the string with 3 chars at the end replaced by '...'.
 * @param s string
 * @param minLength
 * @param maxLength
 * @returns Formatted string
 */
function formatStr(s: string, minLength = 2, maxLength = 128) {
  return s.length <= maxLength
    ? s.padEnd(minLength)
    : `${s.slice(0, maxLength - 3)}...`;
}

// TypeScript

type iTunesAppName = "iTunes" | "Music";

interface iTunesProps {
  id: number;
  name: string;
  artist: string;
  album: string;
  year: number;
  duration?: number;
  playerPosition: number;
}

interface iTunesInfos {
  artwork: string | null;
  url: string | null;
}

interface iTunesSearchResponse {
  resultCount: number;
  results: iTunesSearchResult[];
}

interface iTunesSearchResult {
  trackName: string;
  collectionName: string;
  artworkUrl100: string;
  trackViewUrl: string;
}
