#!/usr/bin/env deno run --unstable --allow-env --allow-run --allow-net --allow-read --allow-write --allow-ffi

import type { Activity } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import { Client } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import type {} from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/global.d.ts";
import { run } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/mod.ts";
import type { iTunes } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/types/core.d.ts";

// Cache

class Cache {
  static VERSION = 3;
  static CACHE_FILE = "cache.json";
  static #data: Map<string, iTunesInfos> = new Map();

  static get(key: string) {
    return this.#data.get(key);
  }

  static set(key: string, value: iTunesInfos) {
    this.#data.set(key, value);
    this.saveCache();
  }

  static async loadCache() {
    try {
      const text = await Deno.readTextFile(this.CACHE_FILE);
      const data = JSON.parse(text);
      if (data.version !== this.VERSION) throw new Error("Old cache");
      this.#data = new Map(data.data);
    } catch (err) {
      console.error(
        err,
        `No valid ${this.CACHE_FILE} found, generating a new cache...`
      );
    }
  }

  static async saveCache() {
    try {
      await Deno.writeTextFile(
        this.CACHE_FILE,
        JSON.stringify({
          version: this.VERSION,
          data: Array.from(this.#data.entries()),
        })
      );
    } catch (err) {
      console.error(err);
    }
  }
}

// Main part

const MACOS_VER = await getMacOSVersion();
const IS_APPLE_MUSIC = MACOS_VER >= 10.15;
const APP_NAME: iTunesAppName = IS_APPLE_MUSIC ? "Music" : "iTunes";
const CLIENT_ID = IS_APPLE_MUSIC ? "773825528921849856" : "979297966739300416";
start();

async function start() {
  await Cache.loadCache();
  main();
}

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
  const proc = Deno.run({
    cmd: ["sw_vers", "-productVersion"],
    stdout: "piped",
  });
  const rawOutput = await proc.output();
  proc.close();
  const output = new TextDecoder().decode(rawOutput);
  const version = parseFloat(output.match(/\d+\.\d+/)![0]);
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

async function searchAlbum(props: iTunesProps): Promise<iTunesInfos> {
  const { artist, album } = props;
  const cacheIndex = `${artist} ${album}`;
  let infos = Cache.get(cacheIndex);

  if (!infos) {
    infos = await _searchAlbum(artist, album);
    Cache.set(cacheIndex, infos);
  }

  return infos;
}

async function _searchAlbum(
  artist: string,
  album: string
): Promise<iTunesInfos> {
  const query = `${artist} ${album}`;
  const params = new URLSearchParams({
    media: "music",
    entity: "album",
    term: album.includes(artist) ? artist : query,
    // If the album name contains the artist name,
    // don't limit the results as the first result might not be the right album
    limit: album.includes(artist) ? "" : "1",
  });
  const resp = await fetch(`https://itunes.apple.com/search?${params}`);
  const json: iTunesSearchResponse = await resp.json();

  let result: iTunesSearchResult | undefined;
  if (json.resultCount === 1) {
    result = json.results[0];
  } else if (json.resultCount > 1) {
    // If there are multiple results, find the right album
    result = json.results.find((r) => r.collectionName === album);
  } else if (album.match(/\(.*\)$/)) {
    // If there are no results, try to remove the part
    // of the album name in parentheses (e.g. "Album (Deluxe Edition)")
    return await _searchAlbum(artist, album.replace(/\(.*\)$/, "").trim());
  }

  const artwork = result?.artworkUrl100 ?? null;
  const url = result?.collectionViewUrl ?? null;
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
        const infos = await searchAlbum(props);
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
  artworkUrl100: string;
  collectionViewUrl: string;
  collectionName: string;
}
