import '@jxa/global-type';
import { run } from '@jxa/run';
import { Client, Presence } from 'discord-rpc';
import ItunesSearch, {
  ItunesEntityMusic,
  ItunesMedia,
  ItunesSearchOptions,
} from 'node-itunes-search';

let rpc: Client;
let timer: number;

function main() {
  rpc = new Client({ transport: 'ipc' });
  rpc.on('connected', () => {
    setActivity();
    timer = setInterval(setActivity, 15e3);
  });
  // @ts-ignore: undocumented event?
  rpc.on('disconnected', () => {
    clearInterval(timer);
    rpc.destroy().catch(console.error);
    main();
  });
  rpc
    .login({ clientId: '773825528921849856' })
    .then(console.log)
    .catch((e) => {
      console.error(e);
      setTimeout(main, 15e3);
    });
}

main();

function isOpen(): Promise<boolean> {
  return run(() => Application('System Events').processes['Music'].exists());
}

function getState(): Promise<string> {
  // @ts-ignore: 'Music' replaced 'iTunes' on Catalina and later
  return run(() => (Application('Music') as Application._iTunes).playerState());
}

function getProps(): Promise<iTunesProps> {
  return run(() => {
    // @ts-ignore: 'Music' replaced 'iTunes' on Catalina and later
    const music = Application('Music') as Application._iTunes;
    return {
      ...music.currentTrack().properties(),
      playerPosition: music.playerPosition(),
    };
  });
}

const infosCache = new Map<number, iTunesInfos>();

async function searchAlbum(props: iTunesProps): Promise<iTunesInfos> {
  const { id, artist, album } = props;
  let infos = infosCache.get(id);
  if (!infos) {
    const options = new ItunesSearchOptions({
      term: encodeURI(decodeURI(`${artist} ${album}`)),
      media: ItunesMedia.Music,
      entity: ItunesEntityMusic.Album,
      limit: 1,
    });
    const result = await ItunesSearch.search(options);
    const artwork = result.results[0]?.artworkUrl100 ?? 'appicon';
    const url = result.results[0]?.collectionViewUrl ?? null;
    infos = { artwork, url };
    infosCache.set(id, infos);
  }
  return infos;
}

async function setActivity() {
  const open = await isOpen();
  console.log('isOpen:', open);

  if (open) {
    const state = await getState();
    console.log('state:', state);

    switch (state) {
      case 'playing':
        const props = await getProps();
        console.log('props:', props);

        const infos = await searchAlbum(props);
        console.log('infos:', infos);

        const endTimestamp = Math.ceil(
          Date.now() + (props.duration - props.playerPosition) * 1000
        );
        const year = props.year ? ` (${props.year})` : '';

        const activity: Presence = {
          details: props.name,
          state: `${props.artist} — ${props.album}${year}`,
          endTimestamp,
          largeImageKey: infos.artwork,
          largeImageText: `${props.album}${year}`,
          smallImageKey: state,
        };
        if (infos.url) {
          activity.buttons = [
            {
              label: 'Listen on Apple Music',
              url: infos.url,
            },
          ];
        }

        rpc.setActivity(activity);
        break;
      case 'paused':
      case 'stopped':
        rpc.clearActivity();
        break;
    }
  } else {
    rpc.clearActivity();
  }
}

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
