const path = require('path')
const express = require('express');
const fs = require('fs');

const port = process.env.PORT ?? 3000;
const flag1 = process.env.FLAG1 ?? 'cyber{test_'
const flag2 = process.env.FLAG2 ?? 'AAAAAAA}'

const app = express();



app.head('/flag1', (req, res) => {
  res.setHeader("FLAG", flag1)
  res.send(flag1)
}) 



app.get('/', (req, res) => {
  if(req.headers['user-agent'] === 'ocean explorer') {
    res.send(flag2)
  }
  else {
    res.sendFile(path.join(__dirname, '/index.html'))
  }
})

app.use(express.static('.'));

app.listen(port, () => {
  console.log(`Listening on http://0.0.0.0:${port}`);
});
