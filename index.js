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
  
  return self.add(post, function (err, p) {
    self.get(origId, function (err, orig) {
      orig.replies.push(p)
      self.update(orig.id, orig, function (err) {
        return next(null, p)
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

Watercooler.prototype.getAllWithTag = function getAllWithTag (tag, next) {
  var cleanKey = keys.tag(tag, '').replace(/\#$/, '')
  var streamOpts = {
    gt: cleanKey,
    lt: cleanKey + '\xff'
  }
  var posts = []

  var tagStream = this.db.createReadStream(streamOpts)
  tagStream.on('data', function (d) { posts.push(d) })
  tagStream.on('end', function () { return next(null, posts) })
  tagStream.on('error', next)
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
