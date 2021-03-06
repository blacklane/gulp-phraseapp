// Generated by CoffeeScript 1.12.6
(function() {
  var _, baseUrl, error, fs, getAuthRequest, globalCredentials, gutil, keyCount, log, merge, request,
    slice = [].slice,
    hasProp = {}.hasOwnProperty;

  request = require('request');

  gutil = require('gulp-util');

  merge = require('deep-merge')(function(a, b) {
    return a;
  });

  _ = require('highland');

  fs = require('fs');

  baseUrl = "https://phraseapp.com/api/v2/projects/";

  log = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return gutil.log.apply(gutil, [gutil.colors.green('phraseapp')].concat(args));
  };

  error = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return gutil.log.apply(gutil, [gutil.colors.red('phraseapp')].concat(args));
  };

  keyCount = function(obj) {
    var count, key, val;
    count = 0;
    for (key in obj) {
      if (!hasProp.call(obj, key)) continue;
      val = obj[key];
      if (typeof val === "object") {
        count += keyCount(val);
      } else {
        count += 1;
      }
    }
    return count;
  };

  globalCredentials = {};

  getAuthRequest = function(options) {
    var project, token;
    token = options.accessToken || globalCredentials.accessToken;
    if (token == null) {
      throw new Error("A Phraseapp access token must be present");
    }
    project = options.projectID || globalCredentials.projectID;
    if (project == null) {
      throw new Error("A Phraseapp project id must be present");
    }
    return request.defaults({
      baseUrl: baseUrl + project,
      headers: {
        'Authorization': "token " + token
      }
    });
  };

  exports.init = function(credentials) {
    if (credentials == null) {
      credentials = {};
    }
    return globalCredentials = credentials;
  };

  exports.upload = function(options) {
    var id, path, ref, results;
    if (options == null) {
      options = {};
    }
    request = getAuthRequest(options);
    if (options.files) {
      ref = options.files;
      results = [];
      for (id in ref) {
        path = ref[id];
        results.push((function(id, path) {
          return request({
            url: "/uploads",
            method: 'POST',
            formData: {
              file: fs.createReadStream(path),
              locale_id: id,
              file_format: options.file_format ? options.file_format : 'nested_json'
            }
          }, function(err, res) {
            if (res.statusCode === 201) {
              return log("Uploaded " + path + " (" + id + ")");
            } else {
              return error("Upload of " + path + " failed. Server responded with", res.statusCode);
            }
          });
        })(id, path));
      }
      return results;
    } else {
      return _.pipeline(_.reduce({}, function(acc, file) {
        acc[file.relative.split('.')[0]] = file;
        return acc;
      }), _.flatMap(function(files) {
        return _(request("/locales")).reduce1(_.add).flatMap(function(res) {
          var locales, name;
          locales = JSON.parse(res);
          return _((function() {
            var i, len, ref1, results1;
            results1 = [];
            for (i = 0, len = locales.length; i < len; i++) {
              ref1 = locales[i], id = ref1.id, name = ref1.name;
              if (files[name]) {
                results1.push([files[name], id]);
              }
            }
            return results1;
          })());
        });
      }), _.each(function(arg) {
        var id, vinyl;
        vinyl = arg[0], id = arg[1];
        return request({
          url: "/uploads",
          method: 'POST',
          formData: {
            file: {
              value: vinyl.contents,
              options: {
                filename: vinyl.relative
              },
              contentType: 'application/octet-stream'
            },
            locale_id: id,
            file_format: options.file_format ? options.file_format : 'nested_json'
          }
        }, function(err, res) {
          if (res.statusCode === 201) {
            return log("Uploaded " + vinyl.relative + " (" + id + ")");
          } else {
            return error("Upload of " + vinyl.relative + " failed. Server responded with", res.statusCode);
          }
        });
      }), _.parallel(2));
    }
  };

  exports.download = function(options) {
    if (options == null) {
      options = {};
    }
    request = getAuthRequest(options);
    return _(request("/locales")).reduce1(_.add).flatMap(function(body) {
      var locale, locales;
      locales = JSON.parse(body.toString());
      locales = options.downloadOnly != null ? locales.filter(function(arg) {
        var name;
        name = arg.name;
        return options.downloadOnly.includes(name);
      }) : locales;
      return _((function() {
        var i, len, results;
        results = [];
        for (i = 0, len = locales.length; i < len; i++) {
          locale = locales[i];
          results.push({
            code: locale.code,
            url: "/locales/" + locale.id + "/download",
            qs: {
              file_format: options.file_format ? options.file_format : 'nested_json',
              include_empty_translations: locale.code === options.base || options.includeEmpty ? "1" : "0"
            }
          });
        }
        return results;
      })());
    }).map(function(query) {
      return _(request(query)).reduce1(_.add).map(function(body) {
        var text;
        text = JSON.parse(body.toString());
        log("Downloaded " + query.code + ".json", gutil.colors.cyan((keyCount(text)) + " translations"));
        return {
          code: query.code,
          text: text
        };
      });
    }).parallel(2).group('code').consume(function(err, data, push, next) {
      var code, out, results, text;
      if (err) {
        push(err);
        return next();
      } else if (data === _.nil) {
        return push(null, data);
      } else {
        results = [];
        for (code in data) {
          text = data[code][0].text;
          out = text;
          if (options.base) {
            out = merge(text, data[options.base][0].text);
          }
          push(null, new gutil.File({
            cwd: "",
            base: "",
            path: code + ".json",
            contents: new Buffer(JSON.stringify(out, null, '  '))
          }));
          results.push(next());
        }
        return results;
      }
    });
  };

}).call(this);
