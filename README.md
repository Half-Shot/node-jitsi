node-jitsi
==========

Participate in Jiti Meet calls without requiring a browser!

This project aims to implement the ability to join Jitsi Meet conferences,
with full support for bi-directional audio and video.

Currently the project has just started out and is missing nearly everything
required to get anything working, however progress is being made.

If you want to use Jitsi Meet in a browser context, [jitsi/lib-jitsi-meet](https://github.com/jitsi/lib-jitsi-meet) 
exists as an excellent starting place. This project only aims to run in a Node.JS environment.

## Setup

Currently, this is left as an exercise to the user as the library lacks 
pretty much everything you might want. However, it's a typescript node app 
so setting it up will be fairly standard. 

## Milestones

A set of very high level milestones for the project:

- [x] Join Jitsi Meet conferences
  - [x] Over TCP (normal XMPP)
  - [ ] Over BOSH
- [ ] Send messages in conference rooms
- [ ] Listen to audio
- [ ] Send audio
- [ ] View video
- [ ] Send video

## Support

Come visit us at [#node-jitsi:half-shot.uk](https://matrix.to/#/#node-jitsi:half-shot.uk)!