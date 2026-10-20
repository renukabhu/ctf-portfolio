const path = require('path')
const express = require('express');
const fs = require('fs');

const port = process.env.PORT ?? 3000;
const flag1 = process.env.FLAG ?? 'cyber{test}'
const random = Math.floor(Math.random() * 1000) + 1;

const app = express();

app.get('/a/:num', (req, res) => {
  const n = parseInt(req.params.num, 10);

  if (n === random) {
    res.send(flag1);
  } else {
    res.send('nuh uhhhhhh');
  }
});


app.use(express.static('.'));

app.listen(port, () => {
  console.log(`Listening on http://0.0.0.0:${port}`);
});