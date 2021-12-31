import ItunesSearch, {
	ItunesEntityMusic, ItunesMedia, ItunesSearchOptions
} from "node-itunes-search";

import { iTunesInfo, iTunesProps } from "@interfaces/iTunes";
import CacheManager from "@managers/cacheManager";

import { DEFAULT_APP_ICON } from "../config";

export default class MusicAPI {
	cache: CacheManager;

	constructor() {
		this.cache = new CacheManager(100);
	}

	public async search(props: iTunesProps): Promise<iTunesInfo> {
		const { id, artist, name } = props;
		let infos = this.cache.get(id);
		if (typeof infos !== "undefined") return infos;

		const options = new ItunesSearchOptions({
			limit: 1,
			media: ItunesMedia.Music,
			entity: ItunesEntityMusic.Song,
			term: encodeURI(decodeURI(`${artist} ${name}`))
		});

		const result = await ItunesSearch.search(options),
			artwork = result.results[0]?.artworkUrl100 ?? DEFAULT_APP_ICON,
			url = result.results[0]?.collectionViewUrl ?? null,
			infoSave: iTunesInfo = { artwork, url };

		this.cache.set(id, infoSave);
		return { artwork, url };
	}
}
