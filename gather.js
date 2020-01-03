// A Sorting object codifies the desired reddit sorting.
// The method of a sorting can be the "hot (default)", "top", "controversial", "new" or "rising" section of a subreddit.
// The period is a relevant parameter for a "top" or a "controversial" sorting.
// Calling the .getMethod() and .getPeriod() methods of a Sorting instance guarantees to return valid method and period values.
var Sorting = function(method, period) {
	this.method = method;
	this.period = period;
};
Sorting.prototype.getMethod = function() {
	var sorting = this;
	if (["hot", "top", "new", "controversial", "rising"].indexOf(sorting.method) === -1) {
		return "hot";
	}
	return this.method;
};
Sorting.prototype.getPeriod = function() {
	var sorting = this;
	if (["hour", "day", "week", "month", "year", "all"].indexOf(sorting.period) === -1) {
		return "";
	}
	return this.period;
};

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