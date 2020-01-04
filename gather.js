const https = s => s.slice(0, 5) === "http:" ? "https" + s.slice(4) : s;
const imgRegExps = [/\.jpg$/, /\.jpeg$/, /\.png$/, /\.bmp$/, /\.gif$/];
const gfyRegExps = [/gfycat\.com\/[A-Za-z]+$/,
  /gfycat\.com\/gifs\/detail\/[A-Za-z]+$/];

const extractContentSource = post => new Promise((res, rej) => {
  if (imgRegExps.some(re => re.test(post.url))) {
    res({ src: https(post.url), type: "img" });
  }
  else if (/\.gifv$/.test(post.url)) {
    res({
      src: [".webm", ".mp4"].map(x => https(post.url.replace(/\.\w+$/, x))),
      type: "video"
    });
  }
  else if (/\/\/v\.redd\.it\//.test(post.url)) {
    if (post.media && post.media.reddit_video)
      res({
        src: [https(post.media.reddit_video.fallback_url)],
        type: "video"
      });
    else
      rej(post);
  }
  else if (gfyRegExps.some(re => re.test(post.url))) {
    const id = post.url.match(/\/([A-Za-z]+)$/)[1];
    const r = new XMLHttpRequest();
    r.responseType = "json";
    r.open("GET", "https://api.gfycat.com/v1/gfycats/" + id);
    r.addEventListener("error", () => rej(post));
    r.addEventListener("abort", () => rej(post));
    r.addEventListener("load", function() {
      const sources = [];
      if (r.response && r.response.gfyItem && r.response.gfyItem.webmUrl)
        sources.push(https(r.response.gfyItem.webmUrl));
      if (r.response && r.response.gfyItem && r.response.gfyItem.mp4Url)
        sources.push(https(r.response.gfyItem.mp4Url));
      if (sources.length > 0)
        res({ src: sources, type: "video" });
      else
        rej(post);
    });
    r.send();
  }
  else
    rej(post);
});

const ContentExtractor = function(subreddit, sorting="hot", period="") {
  this.subreddit = subreddit;
  this.sorting = sorting;
  this.period = period;
  this.contentList = [];
  this.listing = [];
  this.after = "";
  this.exhausted = false;
  this.lastContentIndex = 0;
  this.barren = false;
  this.consecutiveEmptyListings = 0;
};
ContentExtractor.prototype.getNextContent =
function() { return (that => new Promise(function(res, rej) {
  const subIsExhausted = function() {
    that.exhausted = true;
    if (that.contentList.length)
      res(that.contentList[0]);
    else {
      that.barren = true;
      rej();
    }
  };
  if (that.barren)
    rej();
  else if (that.exhausted) {
    that.lastContentIndex = that.lastContentIndex + 1;
    if (that.lastContentIndex === that.contentList.length)
      that.lastContentIndex = 0;
    res(that.contentList[that.lastContentIndex]);
  }
  else if (that.listing.length) {
    const post = that.listing.shift();
    extractContentSource(post)
    .then(source => {
      const content = {
        permalink: "https://www.reddit.com" + post.permalink,
        title: post.title,
        subreddit: that.subreddit,
        type: source.type,
        src: source.src
      };
      that.consecutiveEmptyListings = 0;
      that.contentList.push(content);
      res(content);
    })
    .catch(() => {
      that.getNextContent().then(res, rej);
    });
  }
  else if (that.consecutiveEmptyListings < 5) {
    const r = new XMLHttpRequest();
    r.responseType = "json";
    r.open("GET", "https://www.reddit.com/r/" + that.subreddit + "/" +
      that.sorting + ".json?limit=100&t=" + that.period + "&after=" +
      that.after);
    r.addEventListener("load", function() {
      if (r.response.data && r.response.data.children &&
          r.response.data.children.length) {
        that.listing = that.listing.concat(
          r.response.data.children.map(child => child.data));
        that.after = that.listing.slice(-1)[0].name;
        that.consecutiveEmptyListings += 1;
        that.getNextContent().then(res, rej);
      }
      else
        subIsExhausted();
    });
    r.addEventListener("abort", subIsExhausted);
    r.addEventListener("error", subIsExhausted);
    r.send();
  }
  else
    subIsExhausted();
}))(this)};

/*
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
			extractPostSource(fetcher.posts.shift())
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
};*/