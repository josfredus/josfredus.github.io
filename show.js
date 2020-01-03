////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//                           Launch the slideshow                             //
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var launchSlideshow = function(settings) {

document.body.style.overflow = "hidden";
document.body.scroll = "no";
document.body.style.margin = 0;

// Return a Promise that resolves when the media URL has been extracted from a given post's URL.
// If the post does not yield a valid media, the Promise fails.
var promiseExtractMediaURL = function(post) {
	return new Promise(function(resolve, reject) {
		var http2https = function(url) {
			if (url.slice(0, 5) === "http:") {
				return "https" + url.slice(4);
			}
			return url
		};
		if (/\.jpg$/.test(post.url) || /\.png$/.test(post.url) || /\.gif$/.test(post.url)) {
			post.mediaURL = http2https(post.url);
			post.mediaType = "image";
			resolve(post);
		}
		else if (/\.gifv$/.test(post.url)) {
			// https://i.imgur.com/<id>.gifv -> https://i.imgur.com/<id>.gif
			post.mediaURL = http2https(post.url);
			post.mediaType = "gifv";
			resolve(post);
		}
		else if (/gfycat\.com\/[A-Za-z]+$/.test(post.url) ||
				/gfycat\.com\/gifs\/detail\/[A-Za-z]+$/.test(post.url)) {
			// https://gfycat.com/<id> -> https://giant.gfycat.com/<id>.webm
			var xhr = new XMLHttpRequest();
			xhr.responseType = "json";
			xhr.open("GET", "https://api.gfycat.com/v1/gfycats/" + post.url.match(/\/([A-Za-z]+)$/)[1]);
			xhr.addEventListener("error", function() { reject(post); });
			xhr.addEventListener("abort", function() { reject(post); });
			xhr.addEventListener("load", function() {
				if (xhr.response && xhr.response.gfyItem && xhr.response.gfyItem.webmUrl) {
					post.mediaURL = xhr.response.gfyItem.webmUrl;
					post.mediaType = "video";
					resolve(post);
				}
				else {
					reject(post);
				}
			});
			xhr.send();
		}
		else {
			reject(post);
		}
	});
};

// A PostFetcher object is used to fetch the posts of a given subreddit with a given sorting.
var PostFetcher = function(subredditName, sorting) {
	this.subredditName = subredditName;
	this.sorting = (sorting instanceof Sorting) ? sorting : new Sorting("hot", "");
	this.posts = [];
	this.lastPostId = "";
};
// A PostFetcher instance provides a .getNextPostPromise() method which returns a Promise that passes a Post object when resolved.
// The passed Post object represents the next post in line of the PostFetcher's subreddit sorted according to the PostFetcher's Sorting.
// This Post object holds the following data:
//   - url: the URL of the post's link (towards a .jpg file, a gfycat address, etc...);
//   - link: the URL of the post's comments section;
//   - title: the title of the post;
//   - subreddit: the stylised name of the subreddit from which the post is fetched.
//   - mediaURL: the URL of the media to be extracted from the post.
//   - mediaType: "image", "gif", or "webm"
// The PostFetcher fetches posts by batches of 25 posts in a single ajax request.
// If the PostFetcher has posts left in stock, take away the first post in line from the PostFetcher's stock;
//   then get a Promise to extract the media URL of this post by calling promiseExtractMediaURL;
//   if the post contains valid media (image, webm, ...), this Promise resolves
//     and passes the post with its .mediaURL and .mediaType attributes filled,
//     then the original Promise returned by .getNextPostPromise() resolves passing the finalized Post object;
//   if the post does not contain valid media, the Promise fails,
//     and the original Promise returned by .getNextPostPromise() delegates its resolve and reject function
//     to a new .getNextPostPromise() Promise that will try to pass the next first post in line of the PostFetcher's stock.
// If the PostFetcher's stock is empty, which is the case at the first call of the .getNextPostPromise() method and every 100 posts afterward,
//   then the returned Promise sends an XMLHttpRequest to fetch another batch of posts;
//   when the request gets fulfilled, the PostFetcher's stock is filled with the batch of posts,
//   and the returned Promise by .getNextPostPromise() delegates its resolve and reject functions to a new .getNextPostPromise() Promise.
PostFetcher.prototype.getNextPostPromise = function() {
	var fetcher = this;
	return new Promise(function(resolve, reject) {
		if (fetcher.posts.length > 0) {
			promiseExtractMediaURL(fetcher.posts.shift())
			.then(post => resolve(post))
			.catch(post => fetcher.getNextPostPromise().then(resolve, reject));
		}
		else {
			var xhr = new XMLHttpRequest();
			xhr.responseType = "json";
			var xhrUrl = "https://www.reddit.com/r/" + fetcher.subredditName;
			xhrUrl += "/" + fetcher.sorting.getMethod();
			xhrUrl += ".json?limit=100&t=" + fetcher.sorting.getPeriod();
			xhrUrl += "&after=" + fetcher.lastPostId;
			xhr.open("GET", xhrUrl);
			xhr.addEventListener("load", function() {
				if (xhr.response.data.children.length === 0) {
					reject(Error("Reached the end of /r/" + fetcher.subredditName));
					return;
				}
				xhr.response.data.children.forEach(function(post) {
					fetcher.posts.push({
						url: post.data.url,
						link: "https://www.reddit.com" + post.data.permalink,
						title: post.data.title,
						subreddit: post.data.subreddit,
						mediaURL: null,
						mediaType: null,
					});
				});
				fetcher.lastPostId = xhr.response.data.children[xhr.response.data.children.length - 1].data.name;
				fetcher.getNextPostPromise().then(resolve, reject);
			});
			xhr.addEventListener("error", function() { reject(Error("XMLHttpRequest Error (URL: " + xhrUrl + ")")); });
			xhr.addEventListener("abort", function() { reject(Error("XMLHttpRequest Aborted (URL: " + xhrUrl + ")")); });
			xhr.send();
		}
	});
};

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