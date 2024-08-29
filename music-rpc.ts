#!/usr/bin/env deno run --allow-env --allow-run --allow-net --allow-read --allow-write --unstable-ffi --allow-ffi --unstable-kv
import type { Activity } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import { Client } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import type {} from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.5/run/global.d.ts";
import { run } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.5/run/mod.ts";
import type { iTunes } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.5/run/types/core.d.ts";

//#region entrypoint
const MACOS_VER = await getMacOSVersion();
const IS_APPLE_MUSIC = MACOS_VER >= 10.15;
const APP_NAME: iTunesAppName = IS_APPLE_MUSIC ? "Music" : "iTunes";
const CLIENT_ID = IS_APPLE_MUSIC ? "773825528921849856" : "979297966739300416";

const KV_VERSION = 0;
const kv = await Deno.openKv(`cache_v${KV_VERSION}.sqlite3`);

const DEFAULT_TIMEOUT = 15e3;

const rpc = new Client({ id: CLIENT_ID });
while (true) {
  try {
    await main(rpc);
  } catch (err) {
    console.error(err);
    await sleep(DEFAULT_TIMEOUT);
  }
}

async function main(rpc: Client) {
  try {
    await rpc.connect();
    console.log("Connected to Discord RPC");
    while (true) {
      const timeout = await setActivity(rpc);
      await sleep(timeout);
    }
  } catch (err) {
    console.error("Error in main loop:", err);
    await rpc.close(); // Ensure the connection is properly closed

    console.log("Attempting to reconnect...");
    await sleep(DEFAULT_TIMEOUT); // wait before attempting to reconnect
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
//#endregion

//#region macOS/JXA functions
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
//#endregion

//#region iTunes Search API
async function getTrackExtras(props: iTunesProps): Promise<TrackExtras> {
  const { name, artist, album } = props;
  const cacheIndex = `${name} ${artist} ${album}`;
  const entry = await kv.get<TrackExtras>(["extras", cacheIndex]);
  let infos = entry.value;

  if (!infos) {
    infos = await _getTrackExtras(name, artist, album);
    await kv.set(["extras", cacheIndex], infos);
  }

  return infos;
}

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
  const url = `https://itunes.apple.com/search?${params}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    console.error("iTunes API error:", resp.statusText, url);

    return {
      artworkUrl: (await _getMBArtwork(artist, song, album)) ?? null,
      iTunesUrl: null,
    };
  }

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
//#endregion

//#region MusicBrainz
async function _getMBArtwork(
  artist: string,
  song: string,
  album: string
): Promise<string | undefined> {
  const MB_EXCLUDED_NAMES = ["", "Various Artist"];

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

function luceneEscape(term: string): string {
  return term.replace(/([+\-&|!(){}\[\]^"~*?:\\])/g, "\\$1");
}

function removeParenthesesContent(term: string): string {
  return term.replace(/\([^)]*\)/g, "").trim();
}
//#endregion

//#region Activity setter
async function setActivity(rpc: Client): Promise<number> {
  const open = await isOpen();
  console.log("isOpen:", open);

  if (!open) {
    await rpc.clearActivity();
    return DEFAULT_TIMEOUT;
  }

  const state = await getState();
  console.log("state:", state);

  switch (state) {
    case "playing": {
      const props = await getProps();
      console.log("props:", props);

      let delta;
      let end;
      if (props.duration) {
        delta = (props.duration - props.playerPosition) * 1000;
        end = Math.ceil(Date.now() + delta);
      }

      // EVERYTHING must be less than or equal to 128 chars long
      const activity: Activity = {
        // @ts-ignore: "listening to" is allowed in recent Discord versions
        type: 2,
        details: formatStr(props.name),
        timestamps: { end },
        assets: { large_image: "appicon" },
      };

      if (props.artist.length > 0) {
        activity.state = formatStr(props.artist);
      }

      // album.length == 0 for radios
      if (props.album.length > 0) {
        const infos = await getTrackExtras(props);
        console.log("infos:", infos);

        activity.assets = {
          large_image: infos.artworkUrl ?? "appicon",
          large_text: formatStr(props.album),
        };
      }

      await rpc.setActivity(activity);
      return Math.min((delta ?? DEFAULT_TIMEOUT) + 1000, DEFAULT_TIMEOUT);
    }

    case "paused":
    case "stopped": {
      await rpc.clearActivity();
      return DEFAULT_TIMEOUT;
    }

    default:
      throw new Error(`Unknown state: ${state}`);
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
function formatStr(s: string, minLength = 2, maxLength = 128): string {
  return s.length <= maxLength
    ? s.padEnd(minLength)
    : `${s.slice(0, maxLength - 3)}...`;
}
//#endregion

//#region TypeScript
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
//#endregion
