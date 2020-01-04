var launchSlideshow = function(settings) {

document.body.style.overflow = "hidden";
document.body.scroll = "no";

// Create a PostFetcher for each subreddit passed by the settings.
if (settings.subredditList.length === 0) {
	throw Error("No subreddit submitted");
}
var fetchers = [];
settings.subredditList.forEach(function(subredditName) {
	fetchers.push(new PostFetcher(subredditName, settings.sorting));
});

// The nextFetcherIndexGenerator generator yields indexes to be used by an array of PostFetchers.
// If "false" is passed as an argument for the "shuffle" parameter,
//   then the generator yields 0, 1, 2, ..., numberOfFetchers - 1, 0, 1, 2, ..., numberOfFetchers - 1, 0, ...
// Otherwise, the generator yields a shuffled version of the 0, 1, 2, ..., numberOfFetchers - 1 sequence,
//   yielding a reshuffled sequence every time it gets to the last index of the sequence.
var nextFetcherIndexGenerator = function*(numberOfFetchers, shuffle) {
	var indexes = [];
	for (var i = 0; i < numberOfFetchers; i++) {
		indexes.push(i);
	}
	var n = 0;
	var initializeGenerator = function() {
		n = 0;
		if (shuffle) {
			for (var i = numberOfFetchers - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[indexes[i], indexes[j]] = [indexes[j], indexes[i]];
			}
		}
	};
	initializeGenerator();
	while (true) {
		yield indexes[n];
		if (n < numberOfFetchers - 1) {
			n += 1;
		}
		else {
			initializeGenerator();
		}
	}
};
var indexGenerator = nextFetcherIndexGenerator(fetchers.length, settings.shuffleSubreddits);

// The next functions return promises that resolve when a certain event occurs.
// When they resolve, these promises pass the nature of the event they had to detect.
var createNextSlideInputPromise = function() {
	return new Promise(function(resolve, reject) {
		window.addEventListener("keyup", function callback(event) {
			if (["ArrowRight", "Right", " ", "Spacebar"].indexOf(event.key) !== -1) {
				window.removeEventListener("keyup", callback);
				resolve("nextSlideInput");
			}
		});
	});
};
var createPreviousSlideInputPromise = function() {
	return new Promise(function(resolve, reject) {
		window.addEventListener("keyup", function callback(event) {
			if (["ArrowLeft", "Left", "Backspace"].indexOf(event.key) !== -1) {
				window.removeEventListener("keyup", callback);
				resolve("previousSlideInput");
			}
		});
	});
};
var slideshowIsPaused = false;
var createPauseInputPromise = function() {
	return new Promise(function(resolve, reject) {
		window.addEventListener("keyup", function callback(event) {
			if (["p", "P"].indexOf(event.key) !== -1) {
				window.removeEventListener("keyup", callback);
				resolve(slideshowIsPaused ? "resumeInput" : "pauseInput");
			}
		});
	});
};
var slideTimeoutEvent = new Event("slideTimeout");
var createSlideTimeoutPromise = function() {
	return new Promise(function(resolve, reject) {
		window.addEventListener("slideTimeout", function callback(event) {
			window.removeEventListener("slideTimeout", callback);
			resolve("slideTimeout");
		});
	});
};
var slideErrorEvent = new Event("slideError");
var createSlideErrorPromise = function() {
	return new Promise(function(resolve, reject) {
		window.addEventListener("slideError", function callback(event) {
			window.removeEventListener("slideError", callback);
			resolve("slideError");
		});
	});
};

// Display the title and the subreddit of the current post.
const dataDiv = document.body.appendChild(document.createElement("div"));
dataDiv.style.zIndex = 2;
dataDiv.style.position = "absolute";
dataDiv.style.bottom = 0;
dataDiv.style.left = 0;
dataDiv.style.maxWidth = "75%";
dataDiv.style.margin = "1rem";
const dataTitleP = dataDiv.appendChild(document.createElement("p"));
dataTitleP.style.font = "1.5em helvetica, sans-serif";
dataTitleP.style.margin = 0;
const dataTitleA = dataTitleP.appendChild(document.createElement("a"));
dataTitleA.target = "_blank";
dataTitleA.rel = "noreferrer noopener";
dataTitleA.className = "primaryLink";
const dataSubP = dataDiv.appendChild(document.createElement("p"));
dataSubP.style.font = "1em verdana, sans-serif";
dataSubP.style.margin = 0;
const dataSubA = dataSubP.appendChild(document.createElement("a"));
dataSubA.target = "_blank";
dataSubA.rel = "noreferrer noopener";
dataSubA.className = "secondaryLink";
const displayContentData = function(cnt) {
	dataTitleA.textContent = cnt.title;
	dataTitleA.href = cnt.link;
	dataSubA.textContent = "/r/" + cnt.subreddit;
	dataSubA.href = "https://www.reddit.com/r/" + cnt.subreddit;
};

// Display the media element of the current post.
var mediaElement = document.createElement("div");
var placeAndFitMediaElement = function(element) {
	if (element.tagName !== "IMG" && element.tagName !== "VIDEO") return;
	var sourceWidth = (element.tagName === "IMG") ? element.naturalWidth : element.videoWidth;
	var sourceHeight = (element.tagName === "IMG") ? element.naturalHeight : element.videoHeight;
	var widthRatio = sourceWidth / window.innerWidth;
	var heightRatio = sourceHeight / window.innerHeight;
	var maxRatio = Math.max(widthRatio, heightRatio);
	if (maxRatio > 1) {
		element.width = sourceWidth / maxRatio;
		element.height = sourceHeight / maxRatio;
	}
	element.style.position = "absolute";
	element.style.left = String((window.innerWidth - ((element.width === 0) ? sourceWidth : element.width)) / 2) + "px";
	element.style.top = String((window.innerHeight - ((element.height === 0) ? sourceHeight : element.height)) / 2) + "px";
};
var promiseLoadMediaElement = function(post) {
	return new Promise(function(resolve, reject) {
		if (post.mediaType === "image") {
			var newMediaElement = document.createElement("img");
			newMediaElement.zIndex = 0;
			newMediaElement.onerror = error => reject(error);
			newMediaElement.src = post.mediaURL;
			newMediaElement.addEventListener("load", function() {
				placeAndFitMediaElement(newMediaElement);
				if (mediaElement.parentNode) {
					mediaElement.parentNode.removeChild(mediaElement);
				}
				mediaElement = document.body.appendChild(newMediaElement);
				resolve(settings.normalSlideDuration);
			});
		}
		else if (post.mediaType === "video" || post.mediaType === "gifv") {
			var newMediaElement = document.createElement("video");
			newMediaElement.zIndex = 0;
			newMediaElement.onerror = error => reject(error);
			if (post.mediaType === "video") {
				newMediaElement.src = post.mediaURL;
			}
			else {
				var mediaURLWithoutExtension = post.mediaURL.slice(0, -5);
				var webmSource = document.createElement("source");
				var mp4Source = document.createElement("source");
				webmSource.src = mediaURLWithoutExtension + ".webm";
				mp4Source.src = mediaURLWithoutExtension + ".mp4";
				newMediaElement.appendChild(webmSource);
				newMediaElement.appendChild(mp4Source);
			}
			newMediaElement.loop = true;
			newMediaElement.controls = true;
			newMediaElement.addEventListener("canplay", function callback() {
				newMediaElement.removeEventListener("canplay", callback);
				placeAndFitMediaElement(newMediaElement);
				var slideDuration = 0;
				if (isNaN(newMediaElement.duration) || newMediaElement.duration <= 0) {
					slideDuration = settings.normalSlideDuration;
				}
				else {
					while (slideDuration < settings.normalSlideDuration) {
						slideDuration += newMediaElement.duration * 1000;
					}
				}
				if (mediaElement.parentNode) {
					mediaElement.parentNode.removeChild(mediaElement);
				}
				mediaElement = document.body.appendChild(newMediaElement);
				mediaElement.play().then(() => resolve(slideDuration)).catch(() => resolve(slideDuration));
			});
		}
		else {
			reject(Error("no media"));
		}
	});
};
window.addEventListener("resize", function() {
	if (mediaElement.parentNode) {
		placeAndFitMediaElement(mediaElement);
	}
});

// Update the progress indicator.
const css = getComputedStyle(document.body);
const pMaj = css.getPropertyValue("--primary-major");
const pMin = css.getPropertyValue("--primary-minor");
const sMaj = css.getPropertyValue("--secondary-major");
const sMin = css.getPropertyValue("--secondary-minor");
const size = 256;
const canvas = document.body.appendChild(document.createElement("canvas"));
canvas.width = size;
canvas.height = size;
canvas.style.position = "absolute";
canvas.style.zIndex = 1;
canvas.style.bottom = 0;
canvas.style.right = 0;
canvas.style.margin = "1rem";
canvas.style.width = "20rem";
canvas.style.height = "20rem";
const ctx = canvas.getContext("2d");
const launchProgressAnimation = function(duration) {
	const start = Date.now();
	window.requestAnimationFrame(function draw() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!slideshowIsPaused) {
			const time = Date.now() - start;
			const angle = (time / duration - 1/4) * 2 * Math.PI;
			const r1 = size / 2;
      const r2 = r1 * 2/3;
      const r3 = r2 + (r1 - r2) / 3;
			ctx.fillStyle = pMin;
			ctx.beginPath();
			ctx.arc(r1, r1, r1, -Math.PI/2, angle, false);
			ctx.lineTo(r1 + Math.cos(angle) * r2, r1 + Math.sin(angle) * r2);
			ctx.arc(r1, r1, r2, angle, -Math.PI/2, true);
			ctx.fill();
			ctx.closePath();
			ctx.fillStyle = pMaj;
			ctx.beginPath();
			ctx.arc(r1, r1, r3, -Math.PI/2, angle, false);
			ctx.lineTo(r1 + Math.cos(angle) * r2, r1 + Math.sin(angle) * r2);
			ctx.arc(r1, r1, r2, angle, -Math.PI/2, true);
			ctx.fill();
			ctx.closePath();
      if (time < duration)
        window.requestAnimationFrame(draw);
		}
	});
};
var drawPauseSymbol = function() {
	window.requestAnimationFrame(function() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
    const margin = size / 4;
    const barWidth = (size - 2 * margin) / 3;
		ctx.fillStyle = pMin;
		ctx.fillRect(margin, margin, barWidth, size-2*margin);
		ctx.fillRect(size-margin-barWidth, margin, barWidth, size-2*margin);
	});
};

// Run the slideshow.
// First initialize some variables that will play a role in the interface with the slideshow:
//   - The shownPostsMemory, timeTravellerIndex and registerPostInMemory variables will be used
//     when the user uses the "previous slide" ability.
//   - The various input/event promises will be used when processing input/event.
//   - The preloading variables will be used to preload.
// Then start the slideshow by requesting a post from a given PostFetcher,
//   when the PostFetcher's promise resolves, register the passed post in shownPostsMemory,
//   and pass the post down the .then() chain to execute a showSlide(post) function on it.
var shownPostsMemory = [];
var timeTravellerIndex = 0;
var registerPostInMemory = function(post) {
	shownPostsMemory.push(post);
	return post;
};
var slideTimeoutEventTimeout = null;
var nextSlideInputPromise = createNextSlideInputPromise();
var previousSlideInputPromise = createPreviousSlideInputPromise();
var pauseInputPromise = createPauseInputPromise();
var slideTimeoutPromise = createSlideTimeoutPromise();
var slideErrorPromise = createSlideErrorPromise();
var preloadNextPostPromise = true;
var preloadedNextPostPromise = null;

return fetchers[indexGenerator.next().value].getNextPostPromise().then(registerPostInMemory).then(function showSlide(post) {
	// Preload the next post promise.
	if (preloadNextPostPromise) {
		preloadedNextPostPromise = fetchers[indexGenerator.next().value].getNextPostPromise();
		preloadNextPostPromise = false;
	}
	displayContentData(post);
	promiseLoadMediaElement(post).then(function(slideDuration) {
		if (!slideshowIsPaused) {
			launchProgressAnimation(slideDuration);
			slideTimeoutEventTimeout = window.setTimeout(function() { window.dispatchEvent(slideTimeoutEvent); }, slideDuration);
		}
	})
	.catch(function(error) {
		console.log(error);
		window.dispatchEvent(slideErrorEvent);
	});
	// When a relevant event occurs, the showSlide(post) function will be called again,
	//   the passed post will depend on the event that prompted a new slide to be shown.
	// Here, events are seen as promises that resolve when their respective event occurs.
	// When an event-promise resolves, it passes the event's nature as an argument to the .then() chain.
	// All the events-promises compete in a Promise.race() promise, thus the first event-promise to occur will be processed first.
	// As an event-promise passes its nature as argument when it resolves,
	//   the Promise.race() passes the nature of the first event to occur to its .then() chain when it resolves.
	// When an event is processed, its corresponding promise is reset so that it can trigger again when the next slide shows up.
	// If an event is not processed, it will not reset and will therefore be processed in the next cycle.
	return Promise.race([
		slideErrorPromise,
		nextSlideInputPromise,
		previousSlideInputPromise,
		pauseInputPromise,
		slideTimeoutPromise,
	])
	.then(function processInput(event) {
		window.clearTimeout(slideTimeoutEventTimeout);
		slideErrorPromise = createSlideErrorPromise();
		slideTimeoutPromise = createSlideTimeoutPromise();
		if (event === "slideError" || event === "slideTimeout" || event === "nextSlideInput") {
			nextSlideInputPromise = createNextSlideInputPromise();
			if (timeTravellerIndex === 0) {
				preloadNextPostPromise = true;
				return preloadedNextPostPromise.then(registerPostInMemory);
			}
			else {
				timeTravellerIndex = Math.max(timeTravellerIndex - 1, 0);
				return shownPostsMemory[shownPostsMemory.length - 1 - timeTravellerIndex];
			}
		}
		else if (event === "previousSlideInput") {
			previousSlideInputPromise = createPreviousSlideInputPromise();
			timeTravellerIndex = Math.min(timeTravellerIndex + 1, shownPostsMemory.length - 1);
			return shownPostsMemory[shownPostsMemory.length - 1 - timeTravellerIndex];
		}
		else if (event === "pauseInput") {
			pauseInputPromise = createPauseInputPromise();
			slideshowIsPaused = true;
			drawPauseSymbol();
			return Promise.race([nextSlideInputPromise, previousSlideInputPromise, pauseInputPromise]).then(processInput);
		}
		else if (event === "resumeInput") {
			pauseInputPromise = createPauseInputPromise();
			slideshowIsPaused = false;
			return post;
		}
	})
	.then(showSlide);
});

};