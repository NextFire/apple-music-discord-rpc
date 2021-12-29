"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("@jxa/global-type");
const run_1 = require("@jxa/run");
const discord_rpc_1 = require("discord-rpc");
const node_itunes_search_1 = __importStar(require("node-itunes-search"));
let rpc;
let timer;
function main() {
    rpc = new discord_rpc_1.Client({ transport: 'ipc' });
    rpc.on('connected', () => {
        setActivity();
        timer = setInterval(setActivity, 15e3);
    });
    // @ts-ignore
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
    return (0, run_1.run)(() => Application('System Events').processes['Music'].exists());
}
function getState() {
    // @ts-ignore
    return (0, run_1.run)(() => Application('Music').playerState());
}
function getProps() {
    return (0, run_1.run)(() => {
        // @ts-ignore
        const music = Application('Music');
        return Object.assign(Object.assign({}, music.currentTrack().properties()), { playerPosition: music.playerPosition() });
    });
}
const infosCache = new Map();
function searchAlbum(props) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const { id, artist, album } = props;
        let infos = infosCache.get(id);
        if (!infos) {
            const options = new node_itunes_search_1.ItunesSearchOptions({
                term: encodeURI(decodeURI(`${artist} ${album}`)),
                media: node_itunes_search_1.ItunesMedia.Music,
                entity: node_itunes_search_1.ItunesEntityMusic.Album,
                limit: 1,
            });
            const result = yield node_itunes_search_1.default.search(options);
            const artwork = (_b = (_a = result.results[0]) === null || _a === void 0 ? void 0 : _a.artworkUrl100) !== null && _b !== void 0 ? _b : 'appicon';
            const url = (_d = (_c = result.results[0]) === null || _c === void 0 ? void 0 : _c.collectionViewUrl) !== null && _d !== void 0 ? _d : null;
            infos = { artwork, url };
            infosCache.set(id, infos);
        }
        return infos;
    });
}
function setActivity() {
    return __awaiter(this, void 0, void 0, function* () {
        const open = yield isOpen();
        console.log('isOpen:', open);
        if (open) {
            const state = yield getState();
            console.log('state:', state);
            switch (state) {
                case 'playing':
                    const props = yield getProps();
                    console.log('props:', props);
                    const infos = yield searchAlbum(props);
                    console.log('infos:', infos);
                    const activity = {
                        details: props.name,
                        state: `${props.artist} — ${props.album}` +
                            (props.year ? ` (${props.year})` : ''),
                        endTimestamp: Math.ceil(Date.now() + (props.duration - props.playerPosition) * 1000),
                        largeImageKey: infos.artwork,
                        largeImageText: 'Apple Music',
                        smallImageKey: state,
                        smallImageText: `${state[0].toUpperCase() + state.slice(1)}`,
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
        }
        else {
            rpc.clearActivity();
        }
    });
}
