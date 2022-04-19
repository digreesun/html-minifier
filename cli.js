#!/usr/bin/env node
/**
 * html-minifier CLI tool
 *
 * The MIT License (MIT)
 *
 *  Copyright (c) 2014-2016 Zoltan Frombach
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of
 *  this software and associated documentation files (the "Software"), to deal in
 *  the Software without restriction, including without limitation the rights to
 *  use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 *  the Software, and to permit persons to whom the Software is furnished to do so,
 *  subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 *  FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 *  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 *  IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 *  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

'use strict';

var camelCase = require('camel-case');
var fs = require('fs');
var info = require('./package.json');
var minify = require('./' + info.main).minify;
var paramCase = require('param-case');
var path = require('path');
var program = require('commander'); // updated to commander-7.2.0  (npm install commander -g)


program._name = info.name;
program.version(info.version);

function fatal(message) {
  console.error(message);
  process.exit(1);
}



/**
 * JSON does not support regexes, so, e.g., JSON.parse() will not create
 * a RegExp from the JSON value `[ "/matchString/" ]`, which is
 * technically just an array containing a string that begins and end with
 * a forward slash. To get a RegExp from a JSON string, it must be
 * constructed explicitly in JavaScript.
 *
 * The likelihood of actually wanting to match text that is enclosed in
 * forward slashes is probably quite rare, so if forward slashes were
 * included in an argument that requires a regex, the user most likely
 * thought they were part of the syntax for specifying a regex.
 *
 * In the unlikely case that forward slashes are indeed desired in the
 * search string, the user would need to enclose the expression in a
 * second set of slashes:
 *
 *    --customAttrSrround "[\"//matchString//\"]"
 */
function parseRegExp(value) {
  if (value) {
    return new RegExp(value.replace(/^\/(.*)\/$/, '$1'));
  }
}

const JSON5 = require('json5');  // npm -g install json5
function parseJSON(value) {
  if (value) {
    /^\s*[^{:]+:/.test(value) && (value = '{'+ value +'}');
    try {
      //console.error(JSON5.parse(value));
      return JSON5.parse(value);
    }
    catch (e) {
      if (/^\s*{/.test(value)) {
        let p = e.columnNumber || value.length;
        value = value.substring(0, p-1) + '\x1b[7m'+ value[p-1] +'\x1b[27m' + value.substring(p);
        fatal(value + '\n\nCould not parse ' + (e.message||'JSON value'));
      }
      return value;
    }
  }
}

function parseJSONArray(value) {
  if (value) {
    value = parseJSON(value);
    return Array.isArray(value) ? value : [value];
  }
}

function parseJSONRegExpArray(value) {
  value = parseJSONArray(value);
  return value && value.map(parseRegExp);
}

function parseString(value) {
  return value;
}

program.configureHelp({
  sortOptions: false,
  subcommandTerm: (cmd) => cmd.name() // Just show the name, instead of short usage.
});

var mainOptions = {
  caseSensitive: 'Treat attributes in case sensitive manner (useful for SVG; e.g. viewBox)',
  collapseBooleanAttributes: 'Omit attribute values from boolean attributes',
  collapseInlineTagWhitespace: 'Collapse white space around inline tag',
  collapseWhitespace: 'Collapse white space that contributes to text nodes in a document tree.',
  conservativeCollapse: 'Always collapse to 1 space (never remove it entirely)',
  continueOnParseError: 'Handle parse errors instead of aborting',
  customAttrAssign: ['Arrays mof regex\'es that allow to support custom mattribute assign expressions\u200B[33me.g.<div flex?="{{mode != cover}}"></div>[0m', parseJSONRegExpArray],
  customAttrCollapse: ['Regex that specifies custom attribute to strip newlines from\u200B[33me.g. /ng-class/[0m', parseRegExp],
  customAttrSurround: ['Arrays of regex\'es that allow to support custom attribute surround expressions \u200B[33me.g. <input {{#if value}}checked="checked"{{/if}}>[0m', parseJSONRegExpArray],
  customEventAttributes: ['Arrays of regex\'es that allow to support custom event attributes for\u200Bminify JS\u200B[33m(e.g. ng-click)[0m', parseJSONRegExpArray],
  decodeEntities: 'Use direct Unicode characters whenever possible',
  html5: 'Parse input according to HTML5 specifications',
  ignoreCustomComments: ['Array of regex\'es that allow to ignore certain comments, when matched', parseJSONRegExpArray],
  ignoreCustomFragments: ['Array of regex\'es that allow to ignore certain fragments, when matched\u200B[33me.g. <?php ... ?>, {{ ... }}[0m', parseJSONRegExpArray],
  includeAutoGeneratedTags: 'Insert tags generated by HTML parser',
  keepClosingSlash: 'Keep the trailing slash on singleton elements',
  maxLineLength: ['Max line length', parseInt],
  minifySVG: ['Minify SVG elements [33m(svgo)[0m', parseJSON],
  minifyCSS: ['Minify CSS in style elements and style attributes [33m(clean-css)[0m', parseJSON],
  minifyJS: ['Minify Javascript in script elements and on* attributes [33m(uglify-js)[0m', parseJSON],
  minifyURLs: ['Minify URLs in various attributes [33m(relateurl)[0m', parseJSON],
  preserveLineBreaks: 'Always collapse to 1 line break (never remove it entirely)[0m when whitespace between tags include a line break.',
  preventAttributesEscaping: 'Prevents the escaping of the values of attributes.',
  processConditionalComments: 'Process contents of conditional comments through minifier',
  processConditionalCssAuto: 'Enable IE compatiblity for clean-css in conditional comments',
  processScripts: ['Array of strings corresponding to types of script elements to process through minifier \u200B[33me.g. "text/ng-template", "text/x-handlebars-template", etc.[0m', parseJSONArray],
  quoteCharacter: ['Type of quote to use for attribute values ([37m\'[0m or [37m"[0m)', parseString],
  removeAttributeQuotes: 'Remove quotes around attributes when possible.',
  removeComments: 'Strip HTML comments',
  removeEmptyAttributes: 'Remove all attributes with whitespace-only values',
  removeEmptyElements: 'Remove all elements with empty contents',
  removeOptionalTags: 'Remove unrequired tags',
  removeRedundantAttributes: 'Remove attributes when value matches default.',
  removeScriptTypeAttributes: 'Remove [33mtype="text/javascript"[0m from script tags.',
  removeStyleLinkTypeAttributes: 'Remove [33mtype="text/css"[0m from style and link tags.',
  removeTagWhitespace: 'Remove space between attributes whenever possible',
  sortAttributes: 'Sort attributes by frequency',
  sortClassName: 'Sort style classes by frequency',
  trimCustomFragments: 'Trim white space around ignoreCustomFragments.',
  useShortDoctype: 'Replaces the doctype with the short (HTML5) doctype'
};
var mainOptionKeys = Object.keys(mainOptions);
mainOptionKeys.forEach(key => {
  var option = mainOptions[key];
  if (Array.isArray(option)) {
    key = key === 'minifyURLs' ? '--minify-urls' : '--' + paramCase(key);
    key += option[1] === parseJSON ? ' [90m[json-options][0m' : ' [37m<value>[0m';
    program.option('    ' + key, option[0], option[1]);
  }
  else if (~['html5', 'includeAutoGeneratedTags'].indexOf(key)) {
    program.option('    --no-' + paramCase(key), option);
  }
  else {
    program.option('    --' + paramCase(key), option);
  }
});
program.option('-o, --output <file>', 'Specify output file (if not specified STDOUT will be used for output)');

function readFile(file) {
  try {
    return fs.readFileSync(file, { encoding: 'utf8' });
  }
  catch (e) {
    fatal('Cannot read ' + file + '\n' + e.message);
  }
}

var config = {};
program.option('-c, --config-file <file>', 'Use config file', function(configPath) {
  var data = readFile(configPath);
  try {
    config = JSON5.parse(data);
  }
  catch (je) {
    try {
      config = require(path.resolve(configPath));
    }
    catch (ne) {
      fatal('Cannot read the specified config file.\nAs JSON5: ' + je.message + '\nAs module: ' + ne.message);
    }
  }
  mainOptionKeys.forEach(function(key) {
    if (key in config) {
      var option = mainOptions[key];
      if (Array.isArray(option)) {
        var value = config[key];
        config[key] = option[1](typeof value === 'string' ? value : JSON.stringify(value));
      }
    }
  });
});
program.option('    --input-dir <dir>', 'Specify an input directory');
program.option('    --output-dir <dir>', 'Specify an output directory');
program.option('    --file-ext <text>', 'Specify an extension to be read, ex: html');
var content;
program.arguments('[files...]').action(function(files) {
  content = files.map(readFile).join('');
}).parse(process.argv);

const options = program.opts();
//console.error(require('util').inspect(options,{colors:true}))

function minifyOptions() {
  var minify_options = {};
//const options = program.opts();

  mainOptionKeys.forEach(function(key) {
    let param = options[key === 'minifyURLs' ? 'minifyUrls' : camelCase(key)];
    if (typeof param !== 'undefined') {
      minify_options[key] = param;
    }
    else if (key in config) {
      minify_options[key] = config[key];
    }
  });
//console.error(minify_options)
  return minify_options;
}

function mkdir(outputDir, callback) {
  fs.mkdir(outputDir, function(err) {
    if (err) {
      switch (err.code) {
        case 'ENOENT':
          return mkdir(path.join(outputDir, '..'), function() {
            mkdir(outputDir, callback);
          });
        case 'EEXIST':
          break;
        default:
          fatal('Cannot create directory ' + outputDir + '\n' + err.message);
      }
    }
    callback();
  });
}

function processFile(inputFile, outputFile) {
  fs.readFile(inputFile, { encoding: 'utf8' }, function(err, data) {
    if (err) {
      fatal('Cannot read ' + inputFile + '\n' + err.message);
    }
    var minified;
    try {
      minified = minify(data, minifyOptions());
    }
    catch (e) {
      fatal('Minification error on ' + inputFile + '\n' + e.message);
    }
    fs.writeFile(outputFile, minified, { encoding: 'utf8' }, function(err) {
      if (err) {
        fatal('Cannot write ' + outputFile + '\n' + err.message);
      }
    });
  });
}

function processDirectory(inputDir, outputDir, fileExt) {
  fs.readdir(inputDir, function(err, files) {
    if (err) {
      fatal('Cannot read directory ' + inputDir + '\n' + err.message);
    }
    files.forEach(function(file) {
      var inputFile = path.join(inputDir, file);
      var outputFile = path.join(outputDir, file);
      fs.stat(inputFile, function(err, stat) {
        if (err) {
          fatal('Cannot read ' + inputFile + '\n' + err.message);
        }
        else if (stat.isDirectory()) {
          processDirectory(inputFile, outputFile, fileExt);
        }
        else if (!fileExt || path.extname(file) === '.' + fileExt) {
          mkdir(outputDir, function() {
            processFile(inputFile, outputFile);
          });
        }
      });
    });
  });
}

function writeMinify() {
  var minified;
  try {
    minified = minify(content, minifyOptions());
  }
  catch (e) {

    fatal('minify error: ' + e.message + '\n' + e.stack);
  }
  (options.output ? fs.createWriteStream(options.output).on('error', function(e) {
    fatal('Cannot write ' + options.output + '\n' + e.message);
  }) : process.stdout).write(minified);
}


if (options.inputDir || options.outputDir) {
  if (!options.inputDir) {
    fatal('The option output-dir needs to be used with the option input-dir. If you are working with a single file, use -o.');
  }
  if (!options.outputDir) {
    fatal('You need to specify where to write the output files with the option --output-dir');
  }
  processDirectory(options.inputDir, options.outputDir, options.fileExt);
}
// Minifying one or more files specified on the CMD line
else if (content) {
  writeMinify();
}
// Minifying input coming from STDIN
else {
  content = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function(data) {
    content += data;
  }).on('end', writeMinify);
}
