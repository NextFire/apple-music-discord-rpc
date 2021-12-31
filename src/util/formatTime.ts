export const formatTime = (time: number) => {
	const hrs = Math.floor(time / 3600);
	const mins = Math.floor((time % 3600) / 60);
	const secs = Math.floor(time % 60);

	let formattedTime = "";
	if (hrs > 0) {
		formattedTime += "" + hrs + ":" + (mins < 10 ? "0" : "");
	}
	formattedTime += "" + mins + ":" + (secs < 10 ? "0" : "");
	formattedTime += "" + secs;
	return formattedTime;
};
