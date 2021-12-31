import { ItunesEntityMusic, ItunesMedia } from "node-itunes-search";

interface iTunesProps {
	id: number;
	name: string;
	artist: string;
	album: string;
	year: number;
	duration: number;
	playerPosition: number;
}

interface iTunesInfo {
	artwork: string;
	url: string | null;
}
