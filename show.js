var launchSlideshow = function(settings) {

document.body.style.overflow = "hidden";
document.body.scroll = "no";
document.body.style.margin = 0;

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
var postInfoDisplayBlock = document.body.appendChild(document.createElement("div"));
var postInfoDisplayTitleP = postInfoDisplayBlock.appendChild(document.createElement("p"));
var postInfoDisplayTitleLink = postInfoDisplayTitleP.appendChild(document.createElement("a"));
var postInfoDisplaySubredditP = postInfoDisplayBlock.appendChild(document.createElement("p"));
var postInfoDisplaySubredditLink = postInfoDisplaySubredditP.appendChild(document.createElement("a"));
postInfoDisplayBlock.id = "postInfoDisplayBlock";
postInfoDisplayTitleP.id = "postInfoDisplayTitleP";
postInfoDisplayTitleLink.id = "postInfoDisplayTitleLink";
postInfoDisplaySubredditP.id = "postInfoDisplaySubredditP";
postInfoDisplaySubredditLink.id = "postInfoDisplaySubredditLink";
postInfoDisplayTitleLink.target = "_blank";
postInfoDisplaySubredditLink.target = "_blank";
var updatePostInfoDisplay = function(post) {
	postInfoDisplayTitleLink.textContent = post.title;
	postInfoDisplayTitleLink.href = post.link;
	postInfoDisplaySubredditLink.textContent = "/r/" + post.subreddit;
	postInfoDisplaySubredditLink.href = "https://www.reddit.com/r/" + post.subreddit;
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
var colorPrimaryMajor = getComputedStyle(document.body).getPropertyValue("--primary-major");
var colorSecondaryMinor = getComputedStyle(document.body).getPropertyValue("--secondary-minor");
var progressCanvas = document.createElement("canvas");
progressCanvas.id = "progressCanvas";
progressCanvas.width = 100;
progressCanvas.height = 100;
document.body.appendChild(progressCanvas);
var ctx = progressCanvas.getContext("2d");
var launchProgressAnimation = function(slideDuration) {
	var slideStartEpoch = Date.now();
	window.requestAnimationFrame(function draw() {
		ctx.clearRect(0, 0, progressCanvas.width, progressCanvas.height);
		if (!slideshowIsPaused) {
			var elapsedTime = Date.now() - slideStartEpoch;
			var progressAngle = (elapsedTime / slideDuration * 4 - 1) * Math.PI / 2;
			var outerRadius = progressCanvas.width * 2 / 5;
			var innerRadius = progressCanvas.width / 4;
			ctx.fillStyle = colorSecondaryMinor;
			ctx.beginPath();
			ctx.arc(progressCanvas.width / 2, progressCanvas.height / 2, outerRadius, -Math.PI / 2, progressAngle, false);
			ctx.lineTo(progressCanvas.width / 2 + Math.cos(progressAngle) * innerRadius,
				progressCanvas.height / 2 + Math.sin(progressAngle) * innerRadius);
			ctx.arc(progressCanvas.width / 2, progressCanvas.height / 2, innerRadius, progressAngle, -Math.PI / 2, true);
			ctx.fill();
			ctx.closePath();
			ctx.strokeStyle = colorPrimaryMajor;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(progressCanvas.width / 2, progressCanvas.height / 2, outerRadius, -Math.PI / 2, progressAngle, false);
			ctx.stroke();
			window.requestAnimationFrame(draw);
		}
	});
};
var drawPauseSymbol = function() {
	window.requestAnimationFrame(function() {
		ctx.clearRect(0, 0, progressCanvas.width, progressCanvas.height);
		ctx.fillStyle = colorSecondaryMinor;
		ctx.fillRect(progressCanvas.width / 5,
			progressCanvas.height / 5,
			progressCanvas.width / 5,
			progressCanvas.height * 3 / 5);
		ctx.fillRect(progressCanvas.width * 3 / 5,
			progressCanvas.height / 5,
			progressCanvas.width / 5,
			progressCanvas.height * 3 / 5);
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
	updatePostInfoDisplay(post);
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