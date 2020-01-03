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