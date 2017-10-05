const express = require('express');
const nocache = require('nocache');
const uuid = require('uuid');

const app = express();
const port = 3000;

const rpc = require('../services/rpc');
const storage = require('../services/storage');
const Media = require('../entities/Media');

app.use(nocache());

function handle(req, res, next) {
  let { url, width } = req.query;
  let { tenant } = req.params;

  if (!url || !width || !tenant) {
    return res.sendStatus(400);
  }

  storage
    .meta(Media.create({
      tenant,
      url,
      width
    }))
    .then(media => {
      let exists = !!media.meta;

      if (exists) {
        // pipe media from storage to response
        storage
          .get(media)
          .then(media => {
            res.set('Content-Type', media.meta.ContentType);
            res.set('Content-Length', media.meta.ContentLength);
            res.set('Last-Modified', media.meta.LastModified);
            res.set('ETag', media.meta.ETag);

            media.toStream().pipe(res);
          });

        return;
      }

      // request background prepare media
      // then pipe media from storage to response
      rpc({
        command: 'prepare-media',
        media: media.toJSON()
      }, response => {
        if (response.succeed) {
          return handle(req, res, next);
        }

        res.sendStatus(404);
      });
    });
}

app.get('/p/:tenant/media', handle);

app.listen(port, () => console.log(`Server started at ${port}`));
