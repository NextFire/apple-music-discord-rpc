const { run } = require('@jxa/run');
const { Client } = require('discord-rpc');
const itunesAPI = require('node-itunes-search');

let rpc;
let timer;

function main() {
  rpc = new Client({ transport: 'ipc' });
  rpc.on('connected', () => {
    setActivity();
    timer = setInterval(setActivity, 15e3);
  });
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

function isOpen() {
  return run(() => Application('System Events').processes['Music'].exists());
}

function getState() {
  return run(() => Application('Music').playerState());
}

function getProps() {
  return run(() => {
    const music = Application('Music');
    return {
      ...music.currentTrack().properties(),
      playerPosition: music.playerPosition(),
    };
  });
}

async function searchSong(props) {
  const { artist, album } = props;
  const options = {
    term: encodeURI(decodeURI(`${artist} ${album}`)),
    media: 'music',
    entity: 'album',
    limit: 1,
  };

  const result = await itunesAPI.searchItunes(options);
  if (result.results.length !== 0) {
    return [
      result.results[0].artworkUrl100,
      result.results[0].collectionViewUrl,
    ];
  } else return ['appicon', null];
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
        const artwork = await searchSong(props);
        console.log('props:', props);
        const activity = {
          details: props.name,
          state:
            `${props.artist} — ${props.album}` +
            (props.year ? ` (${props.year})` : ''),
          endTimestamp: Math.ceil(
            Date.now() + (props.duration - props.playerPosition) * 1000
          ),
          largeImageKey: artwork[0],
          largeImageText: 'Apple Music',
          smallImageKey: state,
          smallImageText: `${state[0].toUpperCase() + state.slice(1)}`,
        };

        if (!artwork[1]) {
          activity.buttons = [
            {
              label: 'Listen on Apple Music',
              url: artwork[1],
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
