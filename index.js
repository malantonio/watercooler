var EventEmitter = require('events').EventEmitter
var util = require('util')
var Level = require('level')
var crypto = require('crypto')
var noop = function () {}
var prefixes = {
  post: 'post!',
  tag: 'tag!',
  user: 'user!'
}

var keys = {
  post: function (pid) { return prefixes.post + pid },
  tag: function (tag, pid) { return prefixes.tag + tag + '#' + pid },
  user: function (user, pid) { return prefixes.user + user + '#' + pid }
}

module.exports = Watercooler

util.inherits(Watercooler, EventEmitter)

function Watercooler (opts) {
  if (!(this instanceof Watercooler)) return new Watercooler(opts)
  var dbOpts = {
    keyEncoding: 'json',
    valueEncoding: 'json'
  }

  this.db = Level(opts.db || './db', dbOpts)

  EventEmitter.call(this)
}

// {
//   id: '',
//   author: '',
//   comment: '',
//   type: '',
//   replyTo: null,
//   votes: 0,
//   replies: [],
//   tags: []
// }

Watercooler.prototype.add = function addPost (post, next) {
  if (!post.comment) return next(new Error('Invalid comment!'))
  if (!post.author) post.author = 'anonymous'
  if (!post.type) post.type = 'post'
  if (!post.tags) post.tags = []
  if (!next) next = noop

  post.id = Date.now()
  
  // since we're adding a post, we'll assume 0 votes and 0 replies
  post.votes = 0
  post.replies = []

  this.emit('pre-add', post)

  return this.update(post.id, post, next)
}

Watercooler.prototype.addReply = function addReply (origId, post, next) {
  var self = this
  post.replyTo = origId
  post.type = 'reply'

  return self.add(post, function (err, p) {
    self.get(origId, function (err, orig) {
      orig.replies.push(p)
      self.update(orig.id, orig, function (err) {
        return next(null, p)
      })
    })
  })
}

Watercooler.prototype.delete = function deletePost (pid, next) {
  var self = this
  // first let's retreive the post
  this.get(pid, function (err, post) {
    if (err) return next(err)

    self.db.del(keys.post(pid), function (err) {
      if (err) return next(err)
      if (!post.replyTo) return next(null)

      self.get(post.replyTo, function (err, orig) {
        if (err) return next(err)

        orig.replies = orig.replies.filter(function (r) { return r.id !== pid })
        return self.update(orig.id, orig, next)
      })
    })
  })
}

Watercooler.prototype.update = function updatePost (pid, post, next) {
  var self = this
  this.db.put(keys.post(pid), post, function (err) {
    if (err) return next(err)

    self.db.put(keys.user(post.author, pid), post, function (err) {
      if (err) return next(err)
      if (!post.tags.length) return next(null, post)

      var bat = post.tags.map(function (tag) {
        return {
          type: 'put',
          key: keys.tag(tag, pid),
          value: post
        }
      })

      self.db.batch(bat, function (err) {
        if (err) return next(err)
        else {
          self.emit('add', post)
          return next(null, post)
        }
      })
    })
  })
}

Watercooler.prototype.get = function getPost (pid, next) {
  return this.db.get(keys.post(pid), next)
}

Watercooler.prototype.getAllWithTag = function getAllWithTag (tag, opts, next) {
  return this.getAllWith('tag', tag, opts, next)
}

Watercooler.prototype.getAllWithUser = function getAllWithUser (user, opts, next) {
  return this.getAllWith('user', user, opts, next)
}

Watercooler.prototype.getAllWith = function getAllWith (field, key, opts, next) {
  if (!keys[field]) return next(new Error('Field not indexed'))
  if (typeof opts === 'function') {
    next = opts
    opts = {}
  }

  var cleanKey = keys[field](key, '').replace(/\#$/, '')
  var streamOpts = {
    gt: cleanKey,
    lt: cleanKey + '\xff',
    // limit: opts.limit || 10 // paginate?
  }
  var results = []

  var stream = this.db.createReadStream(streamOpts)
  stream.on('data', function (d) { results.push(d) })
  stream.on('end', function () { return next(null, results) })
  stream.on('error', next)
}

Watercooler.prototype.downVote = function downVote (id, next) {
  return this.vote(id, -1, next)
}

Watercooler.prototype.upVote = function upVote (id, next) {
  return this.vote(id, 1, next)
}

Watercooler.prototype.vote = function vote (id, value, next) {
  var self = this
  var key = keys.post(id)

  this.db.get(key, function (err, post) {
    if (err) return next(err)
    else {
      post.votes += value

      self.db.put(key, post, function (err) {
        if (err) return next(err)

        self.emit('vote', id, value, post.votes)
        return next(null, post.votes)
      })
    }
  })
}
