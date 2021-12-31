export default class Song {
	title: string | undefined;
	artist: string | undefined;
	album: string | undefined;
	state: "added" | "playing" | "stopped";
	duration: number | 0;

	constructor() {
		this.title = undefined;
		this.artist = undefined;
		this.album = undefined;
		this.state = "stopped";
		this.duration = 0;
	}
}
