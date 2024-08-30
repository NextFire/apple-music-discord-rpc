#!/usr/bin/env deno run --allow-env --allow-run --allow-net --allow-read --allow-write --unstable-ffi --allow-ffi --unstable-kv
import type { Activity } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import { Client } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";
import type {} from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.5/run/global.d.ts";
import { run } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.5/run/mod.ts";
import type { iTunes } from "https://raw.githubusercontent.com/NextFire/jxa/v0.0.5/run/types/core.d.ts";

//#region RPC
class AppleMusicDiscordRPC {
  static readonly CLIENT_IDS: Record<iTunesAppName, string> = {
    iTunes: "979297966739300416",
    Music: "773825528921849856",
  };
  static readonly KV_VERSION = 0;

  private constructor(
    public readonly appName: iTunesAppName,
    public readonly rpc: Client,
    public readonly kv: Deno.Kv,
    public readonly defaultTimeout: number
  ) {}

  async run(): Promise<void> {
    while (true) {
      try {
        await this.setActivityLoop();
      } catch (err) {
        console.error(err);
      }
      console.log("Reconnecting in %dms", this.defaultTimeout);
      await sleep(this.defaultTimeout);
    }
  }

  async setActivityLoop(): Promise<void> {
    try {
      await this.rpc.connect();
      console.log("Connected to Discord RPC");
      while (true) {
        const timeout = await this.setActivity();
        console.log("Next setActivity in %dms", timeout);
        await sleep(timeout);
      }
    } finally {
      // Ensure the connection is properly closed
      if (this.rpc.ipc) {
        console.log("Closing connection to Discord RPC");
        this.rpc.close();
        this.rpc.ipc = undefined;
      }
    }
  }

  async setActivity(): Promise<number> {
    const open = await isMusicOpen(this.appName);
    console.log("open:", open);

    if (!open) {
      await this.rpc.clearActivity();
      return this.defaultTimeout;
    }

    const state = await getMusicState(this.appName);
    console.log("state:", state);

    switch (state) {
      case "playing": {
        const props = await getMusicProps(this.appName);
        console.log("props:", props);

        let delta, end;
        if (props.duration) {
          delta = (props.duration - props.playerPosition) * 1000;
          end = Math.ceil(Date.now() + delta);
        }

        // EVERYTHING must be less than or equal to 128 chars long
        const activity: Activity = {
          // @ts-ignore: "listening to" is allowed in recent Discord versions
          type: 2,
          details: AppleMusicDiscordRPC.truncateString(props.name),
          timestamps: { end },
          assets: { large_image: "appicon" },
        };

        if (props.artist) {
          activity.state = AppleMusicDiscordRPC.truncateString(props.artist);
        }

        if (props.album) {
          const infos = await this.cachedTrackExtras(props);
          console.log("infos:", infos);

          activity.assets = {
            large_image: infos.artworkUrl ?? "appicon",
            large_text: AppleMusicDiscordRPC.truncateString(props.album),
          };
        }

        await this.rpc.setActivity(activity);
        return Math.min(
          (delta ?? this.defaultTimeout) + 1000,
          this.defaultTimeout
        );
      }

      case "paused":
      case "stopped": {
        await this.rpc.clearActivity();
        return this.defaultTimeout;
      }

      default:
        throw new Error(`Unknown state: ${state}`);
    }
  }

  async cachedTrackExtras(props: iTunesProps): Promise<TrackExtras> {
    const { name, artist, album } = props;
    const cacheIndex = `${name} ${artist} ${album}`;
    const entry = await this.kv.get<TrackExtras>(["extras", cacheIndex]);
    let infos = entry.value;

    if (!infos) {
      infos = await fetchTrackExtras(props);
      await this.kv.set(["extras", cacheIndex], infos);
    }

    return infos;
  }

  static async create(defaultTimeout = 15e3): Promise<AppleMusicDiscordRPC> {
    const macOSVersion = await this.getMacOSVersion();
    const appName: iTunesAppName = macOSVersion >= 10.15 ? "Music" : "iTunes";
    const rpc = new Client({ id: this.CLIENT_IDS[appName] });
    const kv = await Deno.openKv(`cache_v${this.KV_VERSION}.sqlite3`);
    return new this(appName, rpc, kv, defaultTimeout);
  }

  static async getMacOSVersion(): Promise<number> {
    const cmd = new Deno.Command("sw_vers", { args: ["-productVersion"] });
    const output = await cmd.output();
    const decoded = new TextDecoder().decode(output.stdout);
    const version = parseFloat(decoded.match(/\d+\.\d+/)![0]);
    return version;
  }

  static truncateString(value: string, maxLength = 128): string {
    return value.length <= maxLength
      ? value
      : `${value.slice(0, maxLength - 3)}...`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const client = await AppleMusicDiscordRPC.create();
await client.run();
//#endregion

//#region JXA
function isMusicOpen(appName: iTunesAppName): Promise<boolean> {
  return run((appName: iTunesAppName) => {
    return Application("System Events").processes[appName].exists();
  }, appName);
}

function getMusicState(appName: iTunesAppName): Promise<string> {
  return run((appName: iTunesAppName) => {
    const music = Application(appName) as unknown as iTunes;
    return music.playerState();
  }, appName);
}

function getMusicProps(appName: iTunesAppName): Promise<iTunesProps> {
  return run((appName: iTunesAppName) => {
    const music = Application(appName) as unknown as iTunes;
    return {
      ...music.currentTrack().properties(),
      playerPosition: music.playerPosition(),
    };
  }, appName);
}
//#endregion

//#region Extras
async function fetchTrackExtras(props: iTunesProps): Promise<TrackExtras> {
  const json = await iTunesSearch(props);

  let result: iTunesSearchResult | undefined;
  if (json && json.resultCount === 1) {
    result = json.results[0];
  } else if (json && json.resultCount > 1) {
    // If there are multiple results, find the right album
    // Use includes as imported songs may format it differently
    // Also put them all to lowercase in case of differing capitalisation
    result = json.results.find(
      (r) =>
        r.collectionName.toLowerCase().includes(props.album.toLowerCase()) &&
        r.trackName.toLowerCase().includes(props.name.toLowerCase())
    );
  } else if (props.album.match(/\(.*\)$/)) {
    // If there are no results, try to remove the part
    // of the album name in parentheses (e.g. "Album (Deluxe Edition)")
    return await fetchTrackExtras({
      ...props,
      album: props.album.replace(/\(.*\)$/, "").trim(),
    });
  }

  return {
    artworkUrl: result?.artworkUrl100 ?? (await musicBrainzArtwork(props)),
    iTunesUrl: result?.trackViewUrl,
  };
}

async function iTunesSearch(
  { name, artist, album }: iTunesProps,
  retryCount: number = 3
): Promise<iTunesSearchResponse | undefined> {
  // Asterisks tend to result in no songs found, and songs are usually able to be found without it
  const query = `${name} ${artist} ${album}`.replace("*", "");
  const params = new URLSearchParams({
    media: "music",
    entity: "song",
    term: query,
  });
  const url = `https://itunes.apple.com/search?${params}`;

  for (let i = 0; i < retryCount; i++) {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(
        "Failed to fetch from iTunes API: %s %s (Attempt %d/%d)",
        resp.statusText,
        url,
        i + 1,
        retryCount
      );
      resp.body?.cancel();
      await sleep(200);
      continue;
    }
    return (await resp.json()) as iTunesSearchResponse;
  }
}

async function musicBrainzArtwork({
  name,
  artist,
  album,
}: iTunesProps): Promise<string | undefined> {
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
    queryTerms.push(`recording:"${luceneEscape(name)}"`);
  }
  const query = queryTerms.join(" ");

  const params = new URLSearchParams({
    fmt: "json",
    limit: "10",
    query,
  });

  const resp = await fetch(`https://musicbrainz.org/ws/2/release?${params}`);
  const json = (await resp.json()) as MBReleaseLookupResponse;

  for (const release of json.releases) {
    const resp = await fetch(
      `https://coverartarchive.org/release/${release.id}/front`,
      { method: "HEAD" }
    );
    await resp.body?.cancel();
    if (resp.ok) {
      return resp.url;
    }
  }
}

function luceneEscape(term: string): string {
  return term.replace(/([+\-&|!(){}\[\]^"~*?:\\])/g, "\\$1");
}

function removeParenthesesContent(term: string): string {
  return term.replace(/\([^)]*\)/g, "").trim();
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
  artworkUrl?: string;
  iTunesUrl?: string;
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
