var tape = require('tape')
var Watercooler = require('../')
var wc = new Watercooler({db: __dirname + '/db'})

var ex = {
  author: 'test_user',
  comment: 'Hey! I\'m an example comment.',
  type: 'post',
  replyTo: null
}

tape('test adding a post', function (t) {
  wc.add(ex, function (err, post) {
    t.notOk(err, 'no error in adding')
    wc.get(post.id, function (err, p) {
      t.ok(p)
      t.end()
    })
  })
})

tape('not adding a comment results in an Error', function (t) {
  wc.add({}, function (err) {
    t.ok(err, 'error exists')
    t.ok(err instanceof Error, 'err instanceof Error')
    t.end()
  })
})

tape('updating', function (t) {
  wc.add(ex, function (err, p) {
    var update = p.comment = 'LOL I\'M DIFFERENT!'
    wc.update(p.id, p, function (err, u) {
      t.deepEquals(u, p)
      t.end()
    })
  })
})

tape('test upvoting', function (t) {
  wc.add(ex, function (err, post) {
    t.notOk(err)

    wc.upVote(post.id, function (err) {
      wc.get(post.id, function (err, post) {
        t.notOk(err)
        t.equals(post.votes, 1, 'upvoting +1')
        t.end()
      })
    })
  })
})

tape('test downvoting', function (t) {
  wc.add(ex, function (err, post) {
    t.notOk(err)
    wc.downVote(post.id, function (err) {
      wc.get(post.id, function (err, post) {
        t.notOk(err)
        t.equals(post.votes, -1, 'downvoting -1')
        t.end()
      })
    })
  })
})

tape('getAllWithTag', function (t) {
  var tags = ['photo', 'ohno']
  ex.tags = tags

  wc.add(ex, function (err, post) {
    wc.getAllWithTag(tags[1], function (err, res) {
      t.equals(res.length, 1, 'tags should return 1 result')
      wc.getAllWithTag('nope', function (err, res) {
        t.equals(res.length, 0, 'no results should return empty')
        t.end()
      })
    })
  })
})

tape('test reply', function (t) {
  var reply = {
    comment: 'hey I am a reply'
  }

  wc.add(ex, function (err, p) {
    wc.addReply(p.id, reply, function (err, r) {
      t.equals(reply.comment, r.comment, 'returns reply and not related post')
      t.equals(reply.replyTo, p.id, 'linked on replyTo')
      wc.get(reply.replyTo, function (err, post) {
        t.equals(post.replies.length, 1, 'related post has one reply')
        t.equals(post.replies[0].id, r.id, 'reply exists in related post reply array')
        t.end()
      })
    })
  })
})

tape('test delete', function (t) {
  wc.add(ex, function (err, p) {
    wc.delete(p.id, function (err) {
      wc.get(p.id, function (err) {
        t.ok(err.notFound, 'not found error returned')
        t.end()
      })
    })
  })
})

tape('test delete with reply', function (t) {
  var reply = { comment: 'reply here!' }
  var reply2 = { comment: 'me too!' }

  wc.add(ex, function (err, p) {
    wc.addReply(p.id, reply, function (err, re1) {
      wc.addReply(p.id, reply2, function (err, re2) {
        wc.delete(re1.id, function (err) {
          wc.get(p.id, function (err, post) {
            t.equals(post.replies.length, 1, 'only 1 reply remains')
            t.equals(post.replies[0].id, re2.id, 'and the id matches!')
            t.end()
          })
        })
      })
    })
  })
})
