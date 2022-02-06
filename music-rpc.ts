#!/usr/bin/env deno run --unstable --allow-env --allow-run --allow-net --allow-read --allow-write

import {
  Client,
  Activity,
} from "https://raw.githubusercontent.com/NextFire/discord_rpc/main/mod.ts";
import { run } from "https://deno.land/x/jxa_run@v0.0.3/mod.ts";
import type {} from "https://deno.land/x/jxa_run@v0.0.3/global.d.ts";

// Main part

let infosCache: Map<number, iTunesInfos>;

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

async function start() {
  try {
    const text = await Deno.readTextFile("infos.json");
    infosCache = new Map(JSON.parse(text));
  } catch (err) {
    console.log(err + "\n> No infos.json found, creating a new cache...");
    infosCache = new Map();
  }
  main();
}

start();

// Utils functions

function isOpen(): Promise<boolean> {
  return run(() => Application("System Events").processes["Music"].exists());
}

function getState(): Promise<string> {
  return run(() => Application("Music").playerState());
}

function getProps(): Promise<iTunesProps> {
  return run(() => {
    const music = Application("Music");
    return {
      ...music.currentTrack().properties(),
      playerPosition: music.playerPosition(),
    };
  });
}

async function searchAlbum(props: iTunesProps): Promise<iTunesInfos> {
  const { id, artist, album } = props;
  let infos = infosCache.get(id);
  if (!infos) {
    const term = encodeURI(decodeURI(`${artist} ${album}`));
    const resp = await fetch(
      `https://itunes.apple.com/search?media=music&entity=album&limit=1&term=${term}`
    );
    const result = await resp.json();

    const artwork = result.results[0]?.artworkUrl100 ?? "appicon";
    const url = result.results[0]?.collectionViewUrl ?? null;
    infos = { artwork, url };
    infosCache.set(id, infos);

    try {
      await Deno.writeTextFile(
        "infos.json",
        JSON.stringify(Array.from(infosCache.entries()))
      );
    } catch (err) {
      console.error(err);
    }
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
          timestamps: { start: 1, end },
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
        await rpc.setActivity({});
        break;
      }
    }
  } else {
    await rpc.setActivity({});
  }
}

// TypeScript interfaces

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
