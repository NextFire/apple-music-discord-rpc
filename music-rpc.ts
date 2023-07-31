#!/usr/bin/env deno run --unstable --allow-env --allow-run --allow-net --allow-read --allow-write --allow-ffi

import type { Activity } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import { Client } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import type {} from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/global.d.ts";
import { run } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/mod.ts";
import type { iTunes } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.4/run/types/core.d.ts";

// Cache

class Cache {
  static VERSION = 5;
  static CACHE_FILE = "cache.json";
  static #data: Map<string, TrackExtras> = new Map();

  static get(key: string) {
    return this.#data.get(key);
  }

  static set(key: string, value: TrackExtras) {
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

async function getTrackExtras(props: iTunesProps): Promise<TrackExtras> {
  const { name, artist, album } = props;
  const cacheIndex = `${name} ${artist} ${album}`;
  let infos = Cache.get(cacheIndex);

  if (!infos) {
    infos = await _getTrackExtras(name, artist, album);
    Cache.set(cacheIndex, infos);
  }

  return infos;
}

// iTunes Search API

async function _getTrackExtras(
  song: string,
  artist: string,
  album: string
): Promise<TrackExtras> {
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
    return await _getTrackExtras(
      song,
      artist,
      album.replace(/\(.*\)$/, "").trim()
    );
  }

  const artworkUrl =
    result?.artworkUrl100 ?? (await _getMBArtwork(artist, song, album)) ?? null;

  const iTunesUrl = result?.trackViewUrl ?? null;
  return { artworkUrl, iTunesUrl };
}

// MusicBrainz Artwork Getter

const MB_EXCLUDED_NAMES = ["", "Various Artist"];
const luceneEscape = (term: string) =>
  term.replace(/([+\-&|!(){}\[\]^"~*?:\\])/g, "\\$1");
const removeParenthesesContent = (term: string) =>
  term.replace(/\([^)]*\)/g, "").trim();

async function _getMBArtwork(
  artist: string,
  song: string,
  album: string
): Promise<string | undefined> {
  const queryTerms = [];
  if (!MB_EXCLUDED_NAMES.every((elem) => artist.includes(elem))) {
    queryTerms.push(
      `artist:"${luceneEscape(removeParenthesesContent(artist))}"`
    );
  }
  if (!MB_EXCLUDED_NAMES.every((elem) => album.includes(elem))) {
    queryTerms.push(`release:"${luceneEscape(album)}"`);
  } else {
    queryTerms.push(`recording:"${luceneEscape(song)}"`);
  }
  const query = queryTerms.join(" ");

  const params = new URLSearchParams({
    fmt: "json",
    limit: "10",
    query,
  });

  let resp: Response;
  let result: string | undefined;

  resp = await fetch(`https://musicbrainz.org/ws/2/release?${params}`);
  const json: MBReleaseLookupResponse = await resp.json();

  for (const release of json.releases) {
    resp = await fetch(
      `https://coverartarchive.org/release/${release.id}/front`
    );
    if (resp.ok) {
      result = resp.url;
      break;
    }
  }

  return result;
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

      // album.length == 0 for radios
      if (props.album.length > 0) {
        const buttons = [];

        const infos = await getTrackExtras(props);
        console.log("infos:", infos);

        activity.assets = {
          large_image: infos.artworkUrl ?? "appicon",
          large_text: formatStr(props.album),
        };

        if (infos.iTunesUrl) {
          buttons.push({
            label: "Play on Apple Music",
            url: infos.iTunesUrl,
          });
        }

        const query = encodeURIComponent(`artist:${props.artist} track:${props.name}`);
        const spotifyUrl = encodeURI(
          `https://open.spotify.com/search/${query}?si`
        );
        if (spotifyUrl.length <= 512) {
          buttons.push({
            label: "Search on Spotify",
            url: spotifyUrl,
          });
        }

        if (buttons.length > 0) activity.buttons = buttons;
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

interface TrackExtras {
  artworkUrl: string | null;
  iTunesUrl: string | null;
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

interface MBReleaseLookupResponse {
  releases: MBRelease[];
}

interface MBRelease {
  id: string;
}
