const { run } = require('@jxa/run');
const { Client } = require('discord-rpc');

function main() {
  const rpc = new Client({ transport: 'ipc' });
  let timer;
  rpc.on('connected', () => { setActivity(rpc); timer = setInterval(() => setActivity(rpc), 15e3); });
  rpc.on('disconnected', () => { clearInterval(timer); main(); });
  rpc.login({ clientId: '773825528921849856' })
    .then(console.log)
    .catch(e => { console.error(e); setTimeout(main, 15e3); });
};

main();

function isOpen() {
  return run(() => Application('System Events').processes['Music'].exists());
};

function getState() {
  return run(() => Application('Music').playerState());
};

function getProps() {
  return run(() => {
    const music = Application('Music');
    return {
      ...music.currentTrack().properties(),
      playerPosition: music.playerPosition(),
    };
  });
};

async function setActivity(rpc) {
  const open = await isOpen();
  console.log('isOpen:', open);
  if (open) {
    const state = await getState();
    console.log('state:', state);
    switch (state) {
      case 'playing':
        const props = await getProps();
        console.log('props:', props);
        rpc.setActivity({
          details: props.name,
          state: `${props.artist} — ${props.album}` + (props.year ? ` (${props.year})` : ''),
          endTimestamp: Math.ceil(Date.now() + (props.duration - props.playerPosition) * 1000),
          largeImageKey: 'appicon',
          largeImageText: 'Apple Music for macOS',
          smallImageKey: state,
          smallImageText: `${state[0].toUpperCase() + state.slice(1)}『${props.name}』by ${props.artist}` + (props.year ? ` (${props.year})` : ''),
        });
        break;
      case 'paused':
      case 'stopped':
        rpc.clearActivity();
        break;
    };
  };
};
