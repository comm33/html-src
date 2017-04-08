'use strict';
/**
 * Single class performing all your pagebuilding needs.
 * Instantiate if you're performing a full build. Alternatively,
 * you can also use the static methods to obtain the fragmentlist and others for your individual page needs.
 * Extend this class for additional features.
 * XOXO
 */
var inject = require('gulp-inject'); //Injects content to a page
var gulp = require("gulp");
var Promise = require('bluebird');
var plumber = require('gulp-plumber'); //Gulp error handler
var data = require('gulp-data');//file object for handlebars
var hb = require('gulp-hb');//handlebars
var cheerio = require('gulp-cheerio'); //Run jQuery in Gulp
var htmlmin = require('gulp-htmlmin');
var origPath = './pages/';
var fs = require('fs');
var gulpif = require('gulp-if');
 
class PageHelpers {		
    constructor() {
		this.dirlist = [];		
    }
    /**
    * Perform a full build using Promise generators. Throws fragments into memory for every page built 
    * and then ejects them after a page is constructed to avoid memory leaks
    */
    buildAllPages() {
      var self = this;
      this.dirlist = this.walkDirs(origPath, [origPath]);
      return Promise.coroutine(function*(){					
          return yield Promise.each(self.dirlist,  Promise.coroutine(function*(folder) {				
              return yield new Promise( (resolve, reject) => {
                  var pages = gulp.src(folder + "/*.html")
                  .pipe(plumber());
                  PageHelpers.fragmentsItems.forEach(fragmentItemEl => {
                      pages = pages.pipe(PageHelpers.injectItem(fragmentItemEl));
                  });
                  pages.pipe(gulpif(self.checkJSONExists, data(file => {
                    var fileName = file.path.replace(/.*\/([A-Za-z0-9_-]+)\.html/i, '$1');
                    //var filePath = file.path.replace(/.*\/pages\/(.*)/gmi, '$1').replace(/\//g, '\/').replace('.html', '.json');
                    var filePath = file.path.replace('.html', '.json');
                    // return require(origPath + filePath); //'./pages/'
                    return require(filePath); //'./pages/'
                  })))
                  .pipe(gulpif(self.checkJSONExists, hb()))
                  .pipe(plumber())
                    .pipe(cheerio(function ($, file) {
                      $("img:not([alt])").attr("alt", "");//this adds a blank alt tag to images without an alt
                    }))
                  //.pipe(htmlmin({ collapseWhitespace: true }))
                  .pipe(gulp.dest("../html-dest/pages/" + folder.replace(origPath, '')))
                  .on('end', resolve)
                  .on('err', reject);
                });            
          }));
      })();
    }
	/*
     * Walk through all child directories recursively when provided a parent directory
     */
    walkDirs(dir, dirlist) {
        var fs = fs || require('fs'),
            files = fs.readdirSync(dir),
			self = this;
        files.forEach(file => {
            if (fs.statSync(dir + '/' + file).isDirectory()) {
                dirlist.push(dir + '/' + file);
                dirlist = self.walkDirs(dir + '/' + file, dirlist);
            }
        });
        return dirlist;
    }
    checkJSONExists(file) {
      if(fs.existsSync(file.path.replace(/\.html$/i, '.json'))) return true;
    }    
	//static getter for fragment list
	static get fragmentsItems() {
		return this.fragmentsList;
	}
    //static setter for fragment list
	static set fragmentsItems(fragUpdate) {
		this.fragmentsList = fragUpdate;
	}
    //static update to fragment list
	static updateFragmentItems(fragment) {
		this.fragmentsList.push(fragment);
	}
	
	static injectItem(fragmentItem) {
		return inject(gulp.src(['./hbs/' + fragmentItem.path + '.html']), {
			starttag: '<!-- inject:' + fragmentItem.name + ':{{ext}} -->',
			transform: function (filepath, file) {
				return file.contents.toString('utf8');
			}
		});
	}
}
PageHelpers.fragmentsList = [];

module.exports = PageHelpers;
