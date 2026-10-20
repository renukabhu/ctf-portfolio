// app.js ported to a service worker (see emu/express-sw.js). Routes are unchanged.
// The random number is persisted because browsers restart idle service workers.
importScripts("../../emu/express-sw.js", "env.js");

const port = process.env.PORT ?? 3000;
const flag1 = process.env.FLAG ?? 'cyber{test}'
let random;

const app = express();
app.ready(persist("random", () => Math.floor(Math.random() * 1000) + 1).then((n) => (random = n)));

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
