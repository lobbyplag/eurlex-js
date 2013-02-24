# eurlex.js

eurlex.js is a command line utility to retrieve documents (specifically: regulation drafts) of several supported languages (`de`, `en` and `fr` for now) from the [EUR-Lex website](http://eur-lex.europa.eu/) and convert them into [JSON](http://json.org/). It is made with [node.js](http://nodejs.org/) and can be installed locally via [npm](https://npmjs.org/).

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

    eurlex -vu -l de,en,fr COM:2012:0011:FIN -o eurlex-test.json

## License

eurlex.js is licensed under [EUPL](http://joinup.ec.europa.eu/software/page/eupl/licence-eupl)
