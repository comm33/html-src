var gulp = require('gulp');
var rename = require('gulp-rename');
var plumber = require('gulp-plumber');
var tap = require('gulp-tap');
var clean = require('gulp-clean');
var inject = require('gulp-inject');
var data = require('gulp-data');
var hb = require('gulp-hb');
var recursiveFolder = require('gulp-recursive-folder');
var cheerio = require('gulp-cheerio');
var fs = require('fs');
var argv = require('yargs').argv;
var PageHelpers = require('./pageHelpers.js');

var validatePageParams = function() {
	return process.argv[3] === '-p'
		&& typeof process.argv[4] !== 'undefined'
		&& process.argv[5] === '-f'
		&& typeof process.argv[6] !== 'undefined';
}

var ourHelpers = {
	'chart-helper': function () {
		var subText = '', questionBlock = '', sectionsBlock = '', bottomText = '';
		if (this.subtext != null) {
			subText = "<p class='subtext'>" + this.subtext + "</p>";
		}
		for (i = 0; i < this.questions.length; i++) {
			questionBlock += "<div class='row row-" + i + "'>" + this.questions[i] + "</div>";
		}
		questionBlock = "<div class='question-block'>" + questionBlock + "</div>";

		for (i = 0; i < this.sections.length; i++) {
			if ( this.sections[i].preheader ){
				sectionsBlock += "<div class='section-preheader" + ( this.sections[i].preheader["custom-class"]? " " + this.sections[i].preheader["custom-class"]: "" ) + "'>" + this.sections[i].preheader.content + "</div>"
			}
			sectionsBlock += "<div class='section-block'><div class='header-wrapper'><h1 class='header header-" + i + " closed'>" + this.sections[i].header + "</h1></div>";
			if (this["mobile-expand"]){
				sectionsBlock += "<div class='section-" + i + " collapsed'>";
			}
			for (x = 0; x < this.sections[i].answers.length; x++) {
				sectionsBlock += "<strong class='mobile-answer'>" + this.questions[x] + "</strong>";
				sectionsBlock += "<div class='row row-" + x + " " + ("checkbox" in this.sections[i] ? this.sections[i].checkbox[x] : "") + "'>" + this.sections[i].answers[x] + "</div>";
			}
			sectionsBlock += "<button class=' " + (this.sections[i]["button-class"]?this.sections[i]["button-class"]:'button-blue button-width-240') + "' value='" + this.sections[i]['button-value'] + "'>" + this.sections[i].button + "</button></div>";
			if (this["mobile-expand"]){
				sectionsBlock += "</div>";
			}
		}

		if (this.bottomtext != null) {
			bottomText = "<p class='bottomtext'>" + this.bottomtext + "</p>";
		}

		return '<div style="background:white;"><section class="col1 chart-container ' + this["chart-container-class"] + '"><div style="background-image:URL(\'/resources/img/icons/triangle_down_grey.png\')" class="background-50 background-top grey-triangle comparison-table-arrow"></div>' + subText + questionBlock + sectionsBlock + bottomText + '</section></div>';
	}
};

gulp.task('build:portable:html', function() {
	gulp.src('./includes/footer.html')
		.pipe(gulp.dest("../html-dest/resources/includes"))
			.pipe(rename('footer-export.html'))
		.pipe(gulp.dest("../html-dest/resources/includes"));
	return gulp.src('./includes/responsive-nav.html')
		.pipe(gulp.dest("../html-dest/resources/includes"))
			.pipe(rename('responsive-nav-export.html'))
		.pipe(gulp.dest("../html-dest/resources/includes"));
});

/*
 * Generate an array of fragements, specifically inside the PageHelpers class
 */
gulp.task('getFragments', () => {
	PageHelpers.fragmentsItems =[];
	var fragList = PageHelpers.fragmentsItems;
    return gulp.src(['./hbs/containers/**/*.html', './hbs/features/*.html', './hbs/global/*.html'], { read : false
    })
	.pipe(plumber())
	.pipe(tap((file, t) => {
		var filePath = file.path.replace(/.*\\hbs\\(.*)/gmi, '$1').replace(/\\/g, '\/').replace('.html', '');
		var fileName = file.path.replace(/.*\\([A-Za-z0-9_-]+)\.html/i, '$1');
		var fragment = {
		};
		if(filePath.length > 0) fragment.path = filePath;
		if(fileName.length > 0) fragment.name = fileName;
		PageHelpers.updateFragmentItems(fragment);
	}));
});

/*
* Build a single page. Commit all fragments to memory, perform necessary transpiling operations
* and copy constructed file to appropriate location
*/
gulp.task('build:page', ['getFragments', 'clean:templates'], () => {
	if (!validatePageParams()) return false;
	var destPath = '../html-dest/pages/'
	var myPath = process.argv[4];
	myPath = myPath.replace(/^\/|\/$/g, ''); //strip trailing and leading slashes
	var myFileName = process.argv[6];			
  var pages = gulp.src('./pages/' + myPath + '/' + myFileName + '.html') //'./pages/' 	
    .pipe(plumber());
	
	// only run the handlebars stuff if the json file is present
	if(fs.existsSync('./pages/' + myPath + '/' + myFileName + '.json')) {
		var fragList = PageHelpers.fragmentsItems;	
    fragList.forEach(fragmentItemEl => {
        pages = pages.pipe(PageHelpers.injectItem(fragmentItemEl));
    });	
	
		pages.pipe(data(file => require('./pages/' + myPath + '/' + myFileName + '.json'))) //'./pages/'
			.pipe(hb({ helpers: ourHelpers }));
  }
	
	return pages.pipe(cheerio(($, file) => {
		$("img:not([alt])").attr("alt", "");//this adds a blank alt tag to images without an alt
	}))
		//.pipe(htmlclean())
		.pipe(plumber.stop())
		.pipe(gulp.dest(destPath + myPath + '/'));
});
	
gulp.task('clean:templates', function () {
	if(validatePageParams()) {
		var myPath = process.argv[4];
		var myFileName = process.argv[6];		
		return gulp.src("../html-dest/pages/" + myPath + '/' + myFileName + '.html', { read: false })
			.pipe(plumber())
			.pipe(clean({force: true}));
	}
});

/*_____________*/
/*
 * Perform a full build of all html pages in the 'pages' folder 
 */
gulp.task('build:site', ['clean:alltemplates', 'getFragments'], () => {
	var doBuild = new PageHelpers();
	return doBuild.buildAllPages();
});

gulp.task('clean:alltemplates', recursiveFolder({ base: './pages' }, function (folderFound) {
  return gulp.src("../html-dest/" +folderFound.pathTarget + "/*.html", {
    read: false
  })
    .pipe(plumber())
    .pipe(clean({force: true}));
}));


/* gulp.task('build:page', ['getFragments', 'clean:templates'], function () {
	if(validatePageParams()) {
		var myPath = process.argv[4];
		var myFileName = process.argv[6];
		var pages = gulp.src(myPath + '/' + myFileName + '.html')
			.pipe(plumber());
		fragmentsList.forEach(function (fragmentItemEl) {
			pages = pages.pipe(injectItem(fragmentItemEl));
		});
		return pages.pipe(data(function (file) {
			return require('./' + myPath + '/' + myFileName + '.json')
		}))
			.pipe(hb({ helpers: ourHelpers }))
			.pipe(cheerio(function ($, file) {
					$("img:not([alt])").attr("alt", "");//this adds a blank alt tag to images without an alt
			}))
			//.pipe(htmlclean())
			.pipe(plumber.stop())
			.pipe(gulp.dest("../html-dest/" + myPath));
	}
}); */
