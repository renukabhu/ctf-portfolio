// app.js ported to a service worker (see emu/express-sw.js). Routes are unchanged.
importScripts("../../emu/express-sw.js", "env.js");
const flag1 = process.env.FLAG1 ?? 'cyber{test}'

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});


app.post("/newPoster", (req, res) => {
    const { user, poster } = req.body;

    if (user === "admin" && poster) {
        return res.send(flag1);
    } else {
        return res.send("Access denied: YOU ARE NOT THE ADMINNNNNN");
    }
});


app.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});
