const path = require('path')
const express = require('express');
const fs = require('fs');

const port = process.env.PORT ?? 3000;

const app = express();


app.use(express.static('.'));

app.listen(port, () => {
  console.log(`Listening on http://0.0.0.0:${port}`);
});
