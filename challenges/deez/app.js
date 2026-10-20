const path = require('path')
const express = require('express');
const fs = require('fs');

const port = process.env.PORT ?? 3000;
const flag1 = process.env.FLAG1 ?? 'cyber{test}'

const app = express();



app.get('/cashew', (req, res) => {
  res.setHeader("FLAG", flag1)
  res.send(flag1)
}) 



app.use(express.static('.'));

app.listen(port, () => {
  console.log(`Listening on http://0.0.0.0:${port}`);
});
