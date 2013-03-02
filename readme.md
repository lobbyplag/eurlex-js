# eurlex.js

eurlex.js is a command line utility to retrieve documents (specifically: regulation drafts) in all supported languages from the [EUR-Lex website](http://eur-lex.europa.eu/) and convert them into [JSON](http://json.org/). It is made with [node.js](http://nodejs.org/) and can be installed locally via [npm](https://npmjs.org/).

## Install

eurlex.js can be installed using npm:

    npm install -g eurlex

Of course you must have node [node.js](http://nodejs.org/) with [npm](https://npmjs.org/) installed.

eurlex.js works fine with Linux, *BSD and Darwin, but never was tested with Win32.

## Usage

Once installed you can use eurlex on the command line:

    eurlex [options] <EUR-Lex URI>

You get a brief description of all the options with

    eurlex --help

If you are curious what it looks like to get and convert something, try:

    eurlex -vu -l de,en,fr COM:2012:0011:FIN -o eurlex-com-2012-0011-fin.json

## profile.json

Since the HTML otuput of Eurlex is pretty far from being machine readable, eurlex.js applies a lot of magic to read it anyway. The magic can be fine tuned with setting in a file called `profile.json`. Here is a stripped and commented version of `profile.json`:

````javascript
{
	"lang": ["en","de","..."],           // array of avalable languages
	"expressions": {                     // regular expressions
		"lang": "...",                   // to match the language of the document 
		"title": "..."                   // to match the title of the document
	},
	"delimiters": {                      // delimiters (they are all regex)
		"en": {                          // for this language 
			"recitals": ["...","..."],   // start and end of recitals
			"articles": ["...","..."],   // start and end of articles
			"chapter": "^CHAPTER ",      // string to match a chapter
			"section": "^SECTION ",      // string to match a section
			"article": "^Article ",      // string to match an article
			"fixes": [                   // before a line is parsed
				["...","..."],           // .replace(/first/, "second")
				["...","..."]            // as many as you need
			]
		},
		"lv": {
			"recitals": ["...","..."],
			"articles": ["...","..."],
			"chapter": [                 // if this is an array
				"^([XVI]+) NODAĻA",      // if matches: chapter
				"^([XVI]+) NODAĻA$",     // if matches: text missing
				"^([XVI]+) NODAĻA (.*)$" // $1 is the literal, $2 is the text
			],
			"section": [                 // same here...
				"^([0-9]+)\\. IEDAĻA", 
				"^([0-9]+)\\. IEDAĻA$", 
				"^([0-9]+)\\. IEDAĻA (.*)$"
			],
			"article": [                 // note! for article[3] 
				"^([0-9]+)\\. pants",    // $1 is the literal, __$3__ is the text
				"^([0-9]+)\\. pants$", 
				"^([0-9]+)(\\.) pants (.*)$"
			],
			"fixes": []                  // fixes indeed can be empty
		}
	}
}
````

## Limitations & Known issues

* In __Magyar__, paragraphs and points partly use the same literal enclosures, which leads to paragraphs will be interpreted as headless points. You should be safe using `--unify` with another language as first parameter.
* The translations for __Malti__ are formatted pretty crappy and have redundant fragments. You have to hardly rely on the fixes in your profile.json

## License

eurlex.js is licensed under [EUPL](http://joinup.ec.europa.eu/software/page/eupl/licence-eupl)
