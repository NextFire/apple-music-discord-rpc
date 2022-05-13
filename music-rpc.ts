#!/usr/bin/env deno run --unstable --allow-env --allow-run --allow-net --allow-read --allow-write

import { Client } from "https://raw.githubusercontent.com/harmonyland/discord_rpc/ba127c20816af15e2c3cd2c17d81248b097e9bd2/mod.ts";
import type { Activity } from "https://raw.githubusercontent.com/harmonyland/discord_rpc/ba127c20816af15e2c3cd2c17d81248b097e9bd2/mod.ts";
import { run } from "https://raw.githubusercontent.com/NextFire/jxa/64b6de1748ea063c01271edbe9846e37a584e1ab/run/mod.ts";
import type {} from "https://raw.githubusercontent.com/NextFire/jxa/64b6de1748ea063c01271edbe9846e37a584e1ab/run/global.d.ts";
import type { iTunes } from "https://raw.githubusercontent.com/NextFire/jxa/64b6de1748ea063c01271edbe9846e37a584e1ab/run/types/core.d.ts";

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
      const text = await Deno.readTextFile("cache.json");
      const data = JSON.parse(text);
      if (data.version !== this.VERSION) throw new Error("Old cache");
      this.#data = new Map(data.data);
    } catch (err) {
      console.error(err, "No valid cache.json found, generating a new cache");
    }
  }

  static async saveCache() {
    try {
      await Deno.writeTextFile(
        "cache.json",
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

/**
 * limits string to specified number limit
 * will output the string with 3 chars at the end replaced by '...'
 * @param s string
 * @param n char number limit
 * @returns {string}
 */
function limitStr(s: string, n: number): string {
  let l = s;
  if (l.length > n) {
    l = l.substring(0, n - 3) + "...";
  }

  return l;
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
        // EVERYTHING must be less than or equal to 128 chars long
        const props = await getProps();
        console.log("props:", props);

        const infos = await searchAlbum(props);
        console.log("infos:", infos);

        const delta = (props.duration - props.playerPosition) * 1000;
        const end = Math.ceil(Date.now() + delta);

        const activity: Activity = {
          details: limitStr(props.name, 128),
          state: limitStr(props.artist, 128),
          timestamps: { end },
          assets: {
            large_image: infos.artwork,
            large_text: `${limitStr(`${props.album}`, 120)} (${props.year})`,
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
