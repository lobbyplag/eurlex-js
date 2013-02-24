#!/usr/bin/env node

/**
	eurlex.js - Retrieve documents from EUR-Lex and convert them to usable data
	This software is licensed under the European Union Public Licence (EUPL)
	http://joinup.ec.europa.eu/software/page/eupl/licence-eupl
**/

var fs = require("fs");
var path = require("path");
var request = require("request");
var colors = require("colors");
var crypto = require("crypto");
var args = require("vargs").Constructor;
var optimist = require("optimist");

var argv = optimist
	.boolean(['h','v','c','u','r','q'])
	.alias('h','help')
	.describe('h','show help')
	.alias('v','verbose')
	.describe('v','more output')
	.alias('p','profile')
	.describe('p','profile file')
	.alias('l','lang')
	.describe('l','language; more languages can be comma-separated')
	.alias('c','cache')
	.describe('c','enable caching')
	.alias('d','cache-dir')
	.describe('d','the directory where cached files are stored')
	.alias('u','unify')
	.describe('u','compile language versione into an unified data structure')
	.alias('o','out')
	.describe('o','file to save; default is stdout')
	.alias('r','readable')
	.describe('r','make json readable')
	.alias('q','quiet')
	.describe('q','no output whatsoever, except the data of course')
	.usage('$0'.magenta+' '+'[options]'.red+' '+'<EUR-Lex URI>'.green)
	.argv;
		
/* some handy string functions */

String.prototype.pad = function(n,c){
	// is the opposite of .trim()
	n = (typeof n === "undefined") ? 1 : n;
	c = c || ' ';
	var s = c.repeat(n);
	return s+this.toString()+s;
};

String.prototype.repeat = function(n) {
	return new Array(n+1).join(this);
}

String.prototype.repeat = function(n) {
	return new Array(n+1).join(this);
}

String.prototype.sha1 = function() {
	return crypto.createHash('sha1').update(this.toString()).digest("hex");
}

String.prototype.enty = function() {
	/* decode html entities. since the eu finds them suitable for cyrillic instead of utf-8 */
	return this.toString().replace(/&#[0-9]{1,5};/g, function($0){
		return String.fromCharCode(parseInt($0.replace(/^&#([0-9]{1,5});$/,'$1'),10));
	});
}

/* help and check parameter count, since .demand() is not nice */
if (argv.h || argv._.length !== 1) {
	if (!argv.q) console.error('');
	if (!argv.q) optimist.showHelp(console.error);
	process.exit(0);
}

/* search for profile and, if found, import it */
var _profile = false;
try {
	(function(){
		var _check = function(p) {
			var _file = path.resolve.apply(this, new args(arguments).array);
			return (fs.existsSync(_file) && fs.statSync(_file).isFile()) ? _file : false;
		}
		var _file = _check(argv.p) || _check(__dirname, argv.p) || _check("profile.json") || _check(__dirname, "profile.json");
		if (!_file) throw new Error('Please specify a profile.json using the -p parameter');
		try {
			_profile = JSON.parse(fs.readFileSync(_file));
		} catch(e) {
			throw new Error('The specified Profile is not readable');
		}
	})();
} catch(e) {
	if (!argv.q) console.error('Error'.pad().inverse.bold.red, e.message.red);
	process.exit(1);
}

/* determine languages */
var _lang = [];
try {
	(function(){
		var _l = argv.l || _profile.lang;
		if (typeof _l === 'string') _l = _l.split(/[^a-z]+/g);
		if (typeof _l !== 'object') throw new Error('Please specify one ore more languages. Valid languages: '+_profile.lang.join(', '));
		_l.forEach(function(l){
			if (_profile.lang.indexOf(l) >= 0) _lang.push(l);
		});
		if(_lang.length === 0) throw new Error('The language(s) you specified are invalid. Valid languages: '+_profile.lang.join(', '));
	})();
} catch(e) {
	if (!argv.q) console.error('Error'.pad().inverse.bold.red, e.message.red);
	process.exit(1);
}

/* determine caching */
var _cache = false;
try {
	(function(){
		var _check = function(p) {
			var _dir = path.resolve.apply(this, new args(arguments).array);
			return (fs.existsSync(_dir) && fs.statSync(_dir).isDirectory()) ? _dir : false;
		}
		if (argv.c === false) return;
		_cache = _check(argv.d || "cache") || _check(".cache") || _check("/tmp");
		if (!_cache) throw new Error('Please specify a valid folder for caching');
	})();
} catch(e) {
	if (!argv.q) console.error('Error'.pad().inverse.bold.red, e.message.red);
	process.exit(1);
}

/* parse requested uri */
var _uri = false;
try {
	(function(){
		// fits our demands for now, but we could make this better:
		// http://eur-lex.europa.eu/de/tools/help_syntax.htm
		// http://www.ub.uni-konstanz.de/fi/edz/fachspezifische-hilfe/celex-dokumentnummer.html
		var uri = argv._[0];
		var uri = uri.match(/^(com:([0-9]{4}:[0-9]{4}):(rev|fin)|celex:([0-9ce][0-9]{4}[a-z]{1,2}[0-9]{3,4}))(:(bg|es|cs|da|de|et|el|en|fr|ga|it|lv|lt|hu|mt|nl|pl|pt|ro|sk|sl|fi|sv):(not|html|pdf|doc|tiff))?/i);
		if (!uri) throw new Error('Please specify a vaild EUR-Lex URI from the COM or CELEX range.');
		_uri = uri[1].toUpperCase();
	})();
} catch(e) {
	if (!argv.q) console.error('Error'.pad().inverse.bold.red, e.message.red);
	process.exit(1);
}

/* retrieve a document as html from the eurlex website */
var _retrieve = function(_uri, _callback) {
	var _url = "http://eur-lex.europa.eu/LexUriServ/LexUriServ.do?uri="+_uri;
	if (_cache) var _cache_file = path.resolve(_cache, 'lobbyplag-eurlex-'+_uri.sha1());

	var _fetch = function(_url) {
		request(_url, function (error, response, _data) {
			if (error || response.statusCode !== 200) throw new Error("Could not fetch "+_url);

			/* if caching is activated, write the data to cache */
			if (_cache) fs.writeFile(_cache_file, _data);

			_callback(_data);
		});
	}

	if (_cache) {
		/* get the data from cache */
		fs.exists(_cache_file, function(exists){
			fs.readFile(_cache_file, function(err, _data){
				if (err || _data.length === 0) { 
					_fetch(_url);
				} else {
					_callback(_data.toString());
				}
			});
		});
	} else {
		/* fetch a freh copy */
		_fetch(_url);
	}
}

/* get the raw paragraphs from the retrieved html */
var _prepare = function(_data, callback) {

	var _doc = {};

	/* get language from data */
	var _lang = _data.match(new RegExp(_profile.expressions.lang, 'i'));
	if (!_lang) throw new Error('Could not determine language of retrieved data');
	_doc.lang = _lang[1].toLowerCase();

	/* get title from data */
	var _title = _data.match(new RegExp(_profile.expressions.title, 'i'));
	if (!_title) throw new Error('Could not determine title of retrieved document');
	_doc.title = _title[1];

	/* extract content area, thankfully it's delimited by <TXT_TE> and </TXT_TE> */
	var _content = _data.match(/<TXT_TE>([\S\s]*)<\/TXT_TE>/);
	if (!_content) throw new Error('Could not determine content of retrieved document');

	/* extract paragraphs, there is _no_ formatting whatsoever */
	var _paragraphs = _content[1].match(/<p>[\S\s]*?<\/p>/g);
	if (!_paragraphs) throw new Error('Could not determine content of retrieved document');

	/* walk through paragraphs, remove tags and normalize whitespace */
	var paragraphs = [];
	for (var i = 0; i < _paragraphs.length; i++) paragraphs.push(_paragraphs[i].replace(/<p>([\S\s]*?)<\/p>/g, '$1').enty().replace(/[\s]+/g, ' ').replace(/^\s+|\s+$/, ''));

	/* determine recitals and articles by delimiters */
	_doc.recitals = [];
	_doc.articles = [];
	var _record_recitals = false;
	var _record_articles = false;
	var _delim = _profile.delimiters[_doc.lang];
	paragraphs.forEach(function(paragraph){
		if (paragraph.match(new RegExp(_delim.recitals[1]))) _record_recitals = false;
		if (paragraph.match(new RegExp(_delim.articles[1]))) _record_articles = false;
		if (_record_recitals) _doc.recitals.push(paragraph);
		if (_record_articles) _doc.articles.push(paragraph);
		if (paragraph.match(new RegExp(_delim.recitals[0]))) _record_recitals = true;
		if (paragraph.match(new RegExp(_delim.articles[0]))) _record_articles = true;
	});
	
	/* i just called to say i datalove you */
	callback(_doc);
}

/* transform the raw data to structured data */
var _parse = function(_data, callback) {
	
	var _delim = _profile.delimiters[_data.lang];
	
	var _struct = [];
	
	/* title */
	_struct.push({
		"id": "h1",
		"type": "title",
		"literal": null,
		"text": _data.title
	});
	if (argv.v && !argv.q) console.error(('H').pad().grey.inverse.bold, _data.title);
	
	var recital_number = 0;
	
	/* recitals */
	_data.recitals.forEach(function(recital){
		var _recital = recital.match(/^\(([0-9]+)\) (.*)$/);
		if (!_recital) return;
		recital_number++;
		_struct.push({
			"id": "r"+recital_number.toString(),
			"type": "recital",
			"literal": _recital[1],
			"text": _recital[2]
		});
		if (argv.v && !argv.q) console.error(('R'+recital_number).pad().inverse.bold.yellow, _recital[2]);
	});
	
	/* articles */

	var chapter_number = 0;
	var section_number = 0;
	var article_number = 0;
	var paragraph_number = 0;
	var point_number = 0;
	var article_text_number = 0;
	var paragraph_text_number = 0;

	var item = null;
	var _item = null;

	while (_data.articles.length > 0) {
		
		item = _data.articles.shift();
		
		/* ignore empty items */
		if (item === "") continue;
		
		/* apply fixes */
		_delim.fixes.forEach(function(fix){
			item = item.replace(new RegExp(fix[0]), fix[1]);
		});
		
		/* match for chapter */
		if ((typeof _delim.chapter !== 'object') ? item.match(new RegExp(_delim.chapter)) : item.match(new RegExp(_delim.chapter[0]))) {
			/* check if the chapter is broken */
			if ((typeof _delim.chapter !== 'object') ? item.match(new RegExp(_delim.chapter+'([XIV]+)$')) : item.match(new RegExp(_delim.chapter[1]))) item = [item, _data.articles.shift()].join(' ');
			/* get text */
			_item = (typeof _delim.chapter !== 'object') ? item.match(new RegExp(_delim.chapter+'([XIV]+) (.*)$')) : item.match(new RegExp(_delim.chapter[2]));
			if (!_item) throw new Error('Parser stopped on Chapter: '+item);
			/* reset counters */
			chapter_number++;
			section_number = 0;
			paragraph_number = 0;
			point_number = 0;
			article_text_number = 0;
			paragraph_text_number = 0;
			/* push element */
			_struct.push({
				"id": "c"+chapter_number.toString(),
				"type": "chapter",
				"literal": _item[1],
				"text": _item[2]
			});
			if (argv.v && !argv.q) console.error(('C'+chapter_number).pad().inverse.bold.red, _item[2]);
			/* next */
			continue;
		}
		
		/* match for section */
		if ((typeof _delim.section !== 'object') ? item.match(new RegExp(_delim.section,'i')) : item.match(new RegExp(_delim.section[0],'i'))) {
			/* check if the section is broken */
			if ((typeof _delim.section !== 'object') ? item.match(new RegExp(_delim.section+'([0-9]+)$', 'i')) : item.match(new RegExp(_delim.section[1],'i'))) item = [item, _data.articles.shift()].join(' ');
			/* get text */
			_item = (typeof _delim.section !== 'object') ? item.match(new RegExp(_delim.section+'([0-9]+) (.*)$', 'i')) : item.match(new RegExp(_delim.section[2],'i'));
			if (!_item) throw new Error('Parser stopped on Section: '+item);
			/* reset counters */
			section_number++;
			paragraph_number = 0;
			point_number = 0;
			article_text_number = 0;
			paragraph_text_number = 0;
			/* push element */
			_struct.push({
				"id": "c"+chapter_number.toString()+"s"+section_number.toString(),
				"type": "section",
				"literal": _item[1],
				"text": _item[2]
			});
			if (argv.v && !argv.q) console.error(('S'+section_number).pad().inverse.bold.magenta, _item[2]);
			/* next */
			continue;
		}
		
		/* match for article */
		if ((typeof _delim.article !== 'object') ? item.match(new RegExp(_delim.article,'i')) : item.match(new RegExp(_delim.article[0],'i'))) {
			/* check if the article is broken */
			if ((typeof _delim.article !== 'object') ? item.match(new RegExp(_delim.article+'([0-9]+)$')) : item.match(new RegExp(_delim.article[1],'i'))) item = [item, _data.articles.shift()].join(' ');
			/* get text */
			_item = (typeof _delim.article !== 'object') ? item.match(new RegExp(_delim.article+'([0-9]+)(\.[º°])? (.*)$')) : item.match(new RegExp(_delim.article[2],'i'));
			if (!_item) throw new Error('Parser stopped on Article: '+item);
			/* reset counters */
			article_number++;
			paragraph_number = 0;
			point_number = 0;
			article_text_number = 0;
			paragraph_text_number = 0;
			/* push element */
			_struct.push({
				"id": "a"+article_number.toString(),
				"type": "article",
				"literal": _item[1],
				"text": _item[3]
			});
			if (argv.v && !argv.q) console.error(('A'+article_number).pad().inverse.bold.blue, _item[3]);
			/* next */
			continue;
		}
		
		// thats it with the easy part. now wish me luck.

		/* match for paragraph */
		if (item.match(/^([0-9]+)\. /)) {
			_item = item.match(/^([0-9]+)\. (.*)$/);
			if (!_item) throw new Error('Parser stopped on Paragraph: '+item);
			paragraph_number++;
			point_number = 0;
			paragraph_text_number = 0;
			/* push element */
			_struct.push({
				"id": "a"+article_number.toString()+"p"+paragraph_number.toString(),
				"type": "paragraph",
				"literal": _item[1],
				"text": _item[2]
			});
			if (argv.v && !argv.q) console.error(('P'+paragraph_number).pad().inverse.bold.cyan, _item[2]);
			/* next */
			continue;
		}
		
		/* match for point */
		if (item.match(/^\(?([a-z0-9]+)\) /)) {
			_item = item.match(/^\(?([a-z0-9]+)\) (.*)$/);
			if (!_item) throw new Error('Parser stopped on Point: '+item);
			point_number++;
			_struct.push({
				"id": (paragraph_number > 0) ? "a"+article_number.toString()+"p"+paragraph_number.toString()+"i"+point_number.toString() : "a"+article_number.toString()+"i"+point_number.toString(),
				"type": "point",
				"literal": _item[1],
				"text": _item[2]
			});
			if (argv.v && !argv.q) console.error(('I'+point_number).pad().inverse.bold.green, _item[2]);
			/* next */
			continue;
		}
		
		/* match for text */

		if (paragraph_number === 0 || article_text_number > 0) {
			
			/* it's article-related text (hopefully) */
			article_text_number++;
			
			_struct.push({
				"id": "a"+article_number.toString()+"t"+article_text_number.toString(),
				"type": "introduction",
				"literal": null,
				"text": item
			});
			
			if (argv.v && !argv.q) console.error(('T'+article_text_number).pad().inverse.bold.white, item);
			/* next */
			continue;
			
		} else {
			
			/* it's paragraph-related text (hopefully) */
			paragraph_text_number++;
			
			_struct.push({
				"id": "a"+article_number.toString()+"p"+paragraph_number.toString()+"t"+paragraph_text_number.toString(),
				"type": "subparagraph",
				"literal": null,
				"text": item
			});

			if (argv.v && !argv.q) console.error(('T'+paragraph_text_number).pad().inverse.bold.white, item);
			/* next */
			continue;

		}
		
		throw new Error('Parser stopped on unrecognized Item: '+item);
		
	}
	
	callback(_struct);

}

var _unify = function(data, callback) {
	if (!argv.u) {
		if (typeof callback === "function") callback(data);
	} else {

		var _unified = [];
		var _length = null;
		var _default = null;

		/* check for matching lengths */
		for (var lang in data) {
			if (_length !== null && _length !== data[lang].length) throw new Error('Language versions don\'t match in length: '+_length+' <> '+data[lang].length)
			_length = data[lang].length;
			_default = lang;
		}
		
		/* walk through items in parallel and copypaste */
		for (var i = 0; i < _length; i++) {
			/* fixme: check if id, type and literal match */
			var _item = {
				"id": data[_default][i].id,
				"type": data[_default][i].type,
				"literal": data[_default][i].literal,
				"text": {}
			}
			for (var lang in data) {
				_item.text[lang] = data[lang][i].text;
			}
			_unified.push(_item);
		}

		callback(_unified);

	}
}

var _save = function(data) {
	
	var data_json = (argv.r) ? JSON.stringify(data,null,'\t') : JSON.stringify(data,null,null);
	
	if (!argv.o || argv.o === '-') {
		process.stdout.write(data_json+'\n');
		if (!argv.q) console.error('<3'.pad().magenta.inverse.bold, 'made with datalove'.magenta.bold)
	} else {
		var file = path.resolve(argv.o);
		fs.exists(path.dirname(file), function(exists){
			if (!exists) throw new Error("Could not save output to: "+file);
			fs.writeFileSync(file, data_json);
			if (!argv.q) console.error('<3'.pad().magenta.inverse.bold, 'made with datalove'.magenta.bold)
		});
	}
	
	
}

var _main = function() {
	var _parts = {};
	var _processed = 0;
	_lang.forEach(function(lang){
		uri = [_uri,lang,'html'].join(':').toUpperCase();
		_retrieve(uri, function(data){
			_prepare(data, function(data){
				_parse(data, function(data){
					_parts[lang] = data;
					_processed++;
					if (_processed === _lang.length) {
						_unify(_parts, function(data){
							_save(data); /* done <3 */
						});
					}
				});
			});
		});
	});
}

try {
	_main();
} catch(e) {
	if (!argv.q) console.error('Error'.pad().inverse.bold.red, e.message.red);
	process.exit(1);
}

/* in case error handling fails */
process.on('uncaughtException',function(e){
	/* fixme: make error handling better and remove this */
	if (!argv.q) console.error('Uncaught Exception'.pad().inverse.bold.red, e.message.red);
	process.exit(1);
});

