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

window.onload = function() {
  launchSettingsScreen()
    .then(launchSlideshow)
    .catch(error => console.log(error));
};
