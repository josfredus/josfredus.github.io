
window.onload = function() {

/*
Run a slideshow of pictures, gifs, webms from posts picked uniformly from a list of subreddits.
Start with a form returning:
	- the list of subreddits: the user enters the names of his desired subreddits separated with a space character in a single one-line input;
	- the desired duration of a slide;
	- the sorting of the posts of the different subreddits (hot, top (1 hour, 1 month, ...), controversial...);
	- whether the subreddits must be shuffled every new batch of slides.
Display the slideshow controls below the form.
Once the parameters are fetched from the form, launch the slideshow.
Set up the following controls:
	- jump to next slide on "Space" key press or "Right Arrow" key press;
	- go back to previous slide on "Backspace" key press or "Left Arrow" key press;
	- pause or resume the slideshow on "P" key press, resuming resets the slide duration.
Display in the bottom-left corner:
	- a link to the comment section of the current reddit post;
	- the title of the post as the name of the link;
	- the name of the subreddit the post is from.
Display in the bottom-right corner a progress indicator which:
	- displays the current progress of the slide as a ring the outer area of which linearly fills clockwise:
		- the area is empty when the slide begins;
		- the area is filled when it's time to load the next slide;
	- displays a pause symbol instead when the slideshow is paused.
The following media are accepted as material for the slides:
	- .jpg and .png pictures;
	- .gif and .gifv animated pictures;
	- .webms from gfycat.
Webms influence the duration of a slide as follows:
	- loop the animation until the duration of the whole loop is greater than a slide duration;
	- extend the slide duration match the end of the last loop.
*/






// Create a Promise that creates a form and resolves when this form is filled and submitted.
// Pass the settings to the .then() chain that will launch the slideshow.
var launchSettingsScreen = function() {
	return new Promise(function(resolve, reject) {
		var submitted = false;
		[document.querySelector("#sortingMethodTop"),
			document.querySelector("#sortingMethodControversial")].forEach(element => element.addEventListener("change", function() {
				if (element.checked) {
					document.querySelector("#periodDiv").style.display = "flex";
				}
			}));
		[document.querySelector("#sortingMethodHot"),
			document.querySelector("#sortingMethodNew"),
			document.querySelector("#sortingMethodRising")].forEach(element => element.addEventListener("change", function() {
				if (element.checked) {
					document.querySelector("#periodDiv").style.display = "none";
				}
			}));
		var submit = function() {
			var subredditList = document.querySelector("#subredditList");
			var slideDuration = document.querySelector("#slideDuration");
			if (!/^\w+( \w+)*$/.test(subredditList.value.trim())) {
				return;
			}
			if (slideDuration.value === "" || isNaN(slideDuration.value)) {
				return;
			}
			var sortingMethod = Array.from(document.querySelectorAll("input[name=\"sortingMethod\"]")).find(elem => elem.checked).value;
			var sortingPeriod = "";
			if (sortingMethod === "top" || sortingMethod === "controversial") {
				sortingPeriod = Array.from(document.querySelectorAll("input[name=\"sortingPeriod\"]")).find(elem => elem.checked).value;
			}
			var settings = {
				subredditList: subredditList.value.trim().split(" "),
				sorting: new Sorting(sortingMethod, sortingPeriod),
				normalSlideDuration: Math.round(slideDuration.value * 1000),
				shuffleSubreddits: document.querySelector("#shuffleSubreddits").checked,
			};
			submitted = true;
			document.body.removeChild(document.querySelector("#settingsDiv"));
			resolve(settings);
		};
		window.addEventListener("keyup", function(event) {
			if (!submitted && event.key === "Enter") {
				submit();
			}
		});
	});
};

// Launch the whole program.
launchSettingsScreen().then(launchSlideshow).catch(error => console.log(error));

};
