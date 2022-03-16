#!/usr/bin/env deno run --unstable --allow-env --allow-run --allow-net --allow-read --allow-write

import { Client } from "https://raw.githubusercontent.com/harmonyland/discord_rpc/ba127c20816af15e2c3cd2c17d81248b097e9bd2/mod.ts";
import type { Activity } from "https://raw.githubusercontent.com/harmonyland/discord_rpc/ba127c20816af15e2c3cd2c17d81248b097e9bd2/mod.ts";
import { run } from "https://deno.land/x/jxa_run@v0.0.3/mod.ts";
import type {} from "https://deno.land/x/jxa_run@v0.0.3/global.d.ts";
import type { iTunes } from "https://deno.land/x/jxa_run@v0.0.3/types/core.d.ts";

// Cache

class Cache {
  static VERSION = 1;
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
      const text = await Deno.readTextFile("infos.json");
      const data = JSON.parse(text);
      if (data.version !== this.VERSION) throw new Error("Old cache");
      this.#data = new Map(data.data);
    } catch (err) {
      console.error(err, "No valid infos.json found, generating a new cache");
    }
  }

  static async saveCache() {
    try {
      await Deno.writeTextFile(
        "infos.json",
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

start();

async function start() {
  await Cache.loadCache();
  main();
}

async function main() {
  try {
    const rpc = new Client({ id: "773825528921849856" });
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

// Utils functions

const APP_NAME: iTunesAppName = "Music"; // macOS < Catalina ? "iTunes": "Music"

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

async function searchAlbum(props: iTunesProps): Promise<iTunesInfos> {
  const { artist, album } = props;
  const query = `${artist} ${album}`;
  let infos = Cache.get(query);

  if (!infos) {
    const encodedQuery = encodeURI(decodeURI(query));
    const resp = await fetch(
      `https://itunes.apple.com/search?media=music&entity=album&limit=1&term=${encodedQuery}`
    );
    const result = await resp.json();

    const artwork = result.results[0]?.artworkUrl100 ?? "appicon";
    const url = result.results[0]?.collectionViewUrl ?? null;
    infos = { artwork, url };
    Cache.set(query, infos);
  }

  return infos;
}

// Activity setter

async function setActivity(rpc: Client) {
  const open = await isOpen();
  console.log("isOpen:", open);

  if (open) {
    const state = await getState();
    console.log("state:", state);

    switch (state) {
      case "playing": {
        const props = await getProps();
        console.log("props:", props);

        const infos = await searchAlbum(props);
        console.log("infos:", infos);

        const delta = (props.duration - props.playerPosition) * 1000;
        const end = Math.ceil(Date.now() + delta);
        const year = props.year ? ` (${props.year})` : "";

        const activity: Activity = {
          details: props.name,
          state: `${props.artist} — ${props.album}${year}`,
          timestamps: { end },
          assets: {
            large_image: infos.artwork,
            large_text: props.album,
          },
        };
        if (infos.url) {
          activity.buttons = [
            {
              label: "Listen on Apple Music",
              url: infos.url,
            },
          ];
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
  } else {
    await rpc.clearActivity();
  }
}

// TypeScript

type iTunesAppName = "iTunes" | "Music";

interface iTunesProps {
  id: number;
  name: string;
  artist: string;
  album: string;
  year: number;
  duration: number;
  playerPosition: number;
}

interface iTunesInfos {
  artwork: string;
  url: string | null;
}
