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
  ex.tags = ['example_tag', 'photo']
  wc.add(ex, function (err, post) {
    t.notOk(err, 'no error in adding')

    wc.get(post.id, function (err, p) {
      t.ok(p)

      wc.getAllWithTag('photo', function (err, res) {
        t.equals(res.length, 1, 'tag stream should only have one result')
        t.end()
      })
    })
  })
})

tape('test upvoting', function (t) {
  ex.tags = ['vote_test']

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
  ex.tags = ['downvote_test']

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

tape('test reply', function (t) {
  var reply = {
    comment: 'hey I am a reply',
    tags: ['reply']
  }

  ex.tags = ['original']

  wc.add(ex, function (err, p) {
    wc.addReply(p.id, reply, function (err, r) {
      t.equals(reply.comment, r.comment, 'returns reply and not related post')
      t.ok(reply.replyTo)
      wc.get(reply.replyTo, function (err, post) {
        t.equals(post.replies.length, 1, 'related post has one reply')
        t.equals(post.replies[0].id, r.id, 'reply exists in related post reply array')
        t.end()
      })
    })
  })
})
