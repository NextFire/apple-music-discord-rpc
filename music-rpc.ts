#!/usr/bin/env deno run --allow-env --allow-run --allow-net --allow-read --allow-write --allow-ffi --allow-import --unstable-kv
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
  // Increment after TrackExtras update
  static readonly KV_VERSION = 2;

  private startTime!: number;

  /**
   * @private Use `AppleMusicDiscordRPC.create()` instead.
   */
  constructor(
    private readonly appName: iTunesAppName,
    private readonly rpc: Client,
    private readonly kv: Deno.Kv,
    private readonly defaultTimeout: number = 15 * 1000,
    private readonly maxRuntime: number = 24 * 60 * 60 * 1000, // 24 hours
  ) {}

  async run(): Promise<void> {
    this.startTime = Date.now();
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

  tryCloseRPC(): void {
    if (this.rpc.ipc) {
      console.log("Attempting to close connection to Discord RPC");
      try {
        this.rpc.close();
      } finally {
        console.log("Connection to Discord RPC closed");
        this.rpc.ipc = undefined;
      }
    }
  }

  async setActivityLoop(): Promise<void> {
    const discordRunning = await isDiscordRunning();
    if (!discordRunning) {
      console.log("No Discord client is running");
      return;
    }
    try {
      await this.rpc.connect();
      console.log("Connected to Discord RPC");
      while (true) {
        if (Date.now() - this.startTime >= this.maxRuntime) {
          console.log("Max runtime reached, restarting to clear memory");
          Deno.exit(0);
        }
        const timeout = await this.setActivity();
        console.log("Next setActivity in %dms", timeout);
        await sleep(timeout);
      }
    } finally {
      // Ensure the connection is properly closed
      this.tryCloseRPC();
    }
  }

  async setActivity(): Promise<number> {
    const musicRunning = await isMusicRunning(this.appName);
    console.log("musicRunning:", musicRunning);

    if (!musicRunning) {
      await this.rpc.clearActivity();
      return this.defaultTimeout;
    }

    const state = await getMusicState(this.appName);
    console.log("state:", state);

    switch (state) {
      case "playing": {
        const { activity, delta } = await this.getPlayingActivity();
        await this.rpc.setActivity(activity);
        return Math.min(
          (delta ?? this.defaultTimeout) + 1000,
          this.defaultTimeout,
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

  async getPlayingActivity(): Promise<{ activity: Activity; delta?: number }> {
    const properties = await getMusicProperties(this.appName);
    console.log("properties:", properties);

    let delta, start, end;
    if (properties.duration) {
      delta = (properties.duration - properties.playerPosition) * 1000;
      start = Math.ceil(Date.now() - properties.playerPosition * 1000);
      end = Math.ceil(Date.now() + delta);
    }

    // EVERYTHING must be less than or equal to 128 chars long
    const activity: Activity = {
      // @ts-expect-error: "listening to" has been added in recent Discord versions
      type: 2,
      details: AppleMusicDiscordRPC.ensureValidStringLength(properties.name),
      timestamps: { start, end },
    };

    if (properties.artist) {
      // @ts-expect-error: https://github.com/discord/discord-api-docs/pull/7674
      activity.status_display_type = 1;
      activity.state = AppleMusicDiscordRPC.ensureValidStringLength(
        properties.artist,
      );
    }

    if (properties.album) {
      const extras = await this.cachedTrackExtras(properties);
      console.log("extras:", extras);

      // @ts-expect-error: https://github.com/discord/discord-api-docs/pull/7674
      activity.details_url = extras.trackViewUrl;

      // @ts-expect-error: https://github.com/discord/discord-api-docs/pull/7674
      activity.state_url = extras.artistViewUrl;

      activity.assets = {
        large_image: extras.artworkUrl,
        large_text: AppleMusicDiscordRPC.ensureValidStringLength(
          properties.album,
        ),
        // @ts-expect-error: https://github.com/discord/discord-api-docs/pull/7674
        large_url: extras.collectionViewUrl,
      };

      const buttons: NonNullable<Activity["buttons"]> = [];

      const spotifyQuery = encodeURIComponent(
        `artist:${properties.artist} track:${properties.name}`,
      );
      const spotifyUrl = `https://open.spotify.com/search/${spotifyQuery}?si`;
      if (spotifyUrl.length <= 512) {
        buttons.push({ label: "Search on Spotify", url: spotifyUrl });
      }

      if (buttons.length > 0) {
        activity.buttons = buttons;
      }
    }

    return { activity, delta };
  }

  async cachedTrackExtras(properties: iTunesProperties): Promise<TrackExtras> {
    const cacheId = properties.persistentID;
    const entry = await this.kv.get<TrackExtras>(["extras", cacheId]);
    let extras = entry.value;
    if (!extras) {
      extras = await fetchTrackExtras(this.appName, properties);
      await this.kv.set(["extras", cacheId], extras);
    }
    return extras;
  }

  static async create(
    ...opts: ConstructorParameters<typeof this> extends
      [unknown, unknown, unknown, ...infer T] ? T : never
  ): Promise<AppleMusicDiscordRPC> {
    const macOSVersion = await this.getMacOSVersion();
    const appName: iTunesAppName = macOSVersion >= 10.15 ? "Music" : "iTunes";
    const rpc = new Client({ id: this.CLIENT_IDS[appName] });
    const kv = await Deno.openKv(`cache_v${this.KV_VERSION}.sqlite3`);
    return new this(appName, rpc, kv, ...opts);
  }

  static async getMacOSVersion(): Promise<number> {
    const cmd = new Deno.Command("sw_vers", { args: ["-productVersion"] });
    const output = await cmd.output();
    const decoded = new TextDecoder().decode(output.stdout);
    const version = parseFloat(decoded.match(/\d+\.\d+/)![0]);
    return version;
  }

  static ensureValidStringLength(
    value: string,
    minLength = 2,
    maxLength = 128,
  ): string {
    if (value.length < minLength) {
      return value.padEnd(minLength);
    } else if (value.length > maxLength) {
      return `${value.slice(0, maxLength - 3)}...`;
    } else {
      return value;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const client = await AppleMusicDiscordRPC.create();
await client.run();
//#endregion

//#region JXA
function isDiscordRunning(): Promise<boolean> {
  return run((clientNames: string[]) => {
    const systemEvents = Application("System Events");
    return clientNames.some((clientName) =>
      systemEvents.processes[clientName]?.exists()
    );
  }, ["Discord", "Discord PTB", "Discord Canary"]);
}

function isMusicRunning(appName: iTunesAppName): Promise<boolean> {
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

function getMusicProperties(appName: iTunesAppName): Promise<iTunesProperties> {
  return run((appName: iTunesAppName) => {
    const music = Application(appName) as unknown as iTunes;
    return {
      ...music.currentTrack().properties(),
      playerPosition: music.playerPosition(),
    };
  }, appName);
}

async function getAlbumArtwork(
  appName: iTunesAppName,
): Promise<Blob | undefined> {
  const rawData = await run((appName: iTunesAppName) => {
    const music = Application(appName) as unknown as iTunes;
    return music.currentTrack().artworks[0].rawData();
  }, appName);

  const dataStr = String(rawData);
  const hexMatch = dataStr.match(/\$([0-9A-Fa-f]+)\$/);
  if (!hexMatch) {
    return undefined;
  }

  // Convert hex string to Uint8Array
  const hexString = hexMatch[1];
  const length = hexString.length;
  const data = new Uint8Array(length / 2);
  for (let i = 0; i < length; i += 2) {
    data[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }

  // Detect image format from magic bytes
  let mimeType: string;
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    mimeType = "image/jpeg";
  } else if (
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47
  ) {
    mimeType = "image/png";
  } else if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    mimeType = "image/gif";
  } else if (data[0] === 0x42 && data[1] === 0x4D) {
    mimeType = "image/bmp";
  } else {
    return undefined;
  }

  return new Blob([data], { type: mimeType });
}
//#endregion

//#region Extras
async function fetchTrackExtras(
  appName: iTunesAppName,
  properties: iTunesProperties,
): Promise<TrackExtras> {
  const json = await iTunesSearch(properties);
  const result = findMatchingResult(properties, json);

  // If no results and album has parenthetical suffix, retry without it
  // e.g. "Album (Deluxe Edition)" -> "Album"
  if (!result && properties.album.match(/\(.*\)$/)) {
    return fetchTrackExtras(appName, {
      ...properties,
      album: properties.album.replace(/\(.*\)$/, "").trim(),
    });
  }

  return {
    artworkUrl: result?.artworkUrl100 ?? await uploadedLocalArtworkUrl(appName),
    artistViewUrl: result?.artistViewUrl,
    collectionViewUrl: result?.collectionViewUrl,
    trackViewUrl: result?.trackViewUrl,
  };
}

async function iTunesSearch(
  { name, artist, album }: iTunesProperties,
): Promise<iTunesSearchResponse | undefined> {
  const params = new URLSearchParams({
    media: "music",
    entity: "song",
    term: `${name} ${artist} ${album}`,
    // default to Japan store for more comprehensive results
    // western + asian music
    country: "JP",
  });
  const url = `https://itunes.apple.com/search?${params}`;
  console.log("iTunes search", url);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      return json as iTunesSearchResponse;
    }
    console.error(
      "Failed to fetch from iTunes API: %s %s",
      resp.statusText,
      url,
    );
    resp.body?.cancel();
    await sleep(200);
  }
}

function findMatchingResult(
  properties: iTunesProperties,
  json: iTunesSearchResponse | undefined,
): iTunesSearchResult | undefined {
  if (!json || json.resultCount === 0) {
    return undefined;
  }
  if (json.resultCount === 1) {
    return json.results[0];
  }
  // Multiple results: find the one matching album and track name
  // Use includes() for flexibility with imported songs' formatting
  const albumLower = properties.album.toLowerCase();
  const nameLower = properties.name.toLowerCase();
  return json.results.find(
    (r) =>
      r.collectionName.toLowerCase().includes(albumLower) &&
      r.trackName.toLowerCase().includes(nameLower),
  );
}

async function uploadedLocalArtworkUrl(
  appName: iTunesAppName,
): Promise<string | undefined> {
  const localArtwork = await getAlbumArtwork(appName);
  return localArtwork ? await catboxUpload(localArtwork) : undefined;
}

async function catboxUpload(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  formData.append("fileToUpload", blob, "artwork.jpg");
  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Failed to upload to catbox.moe: ${response.statusText}`);
  }
  const url = await response.text();
  return url.trim();
}
//#endregion

//#region TypeScript
type iTunesAppName = "iTunes" | "Music";

interface iTunesProperties {
  persistentID: string;
  name: string;
  artist: string;
  album: string;
  year: number;
  duration?: number;
  playerPosition: number;
}

interface TrackExtras {
  artworkUrl?: string;
  artistViewUrl?: string;
  collectionViewUrl?: string;
  trackViewUrl?: string;
}

interface iTunesSearchResponse {
  resultCount: number;
  results: iTunesSearchResult[];
}

interface iTunesSearchResult {
  trackName: string;
  collectionName: string;
  artworkUrl100: string;
  artistViewUrl: string;
  collectionViewUrl: string;
  trackViewUrl: string;
}
//#endregion
