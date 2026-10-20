// app.js ported to a service worker (see emu/express-sw.js). Routes are unchanged.
importScripts("../../emu/express-sw.js", "env.js");
const flag1 = process.env.FLAG1 ?? 'cyber{test}'

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.post("/note", (req, res) => {
    if (!req.body.isAdmin || req.body.isAdmin != "true"){
        return res.send("Access denied: YOU ARE NOT THE ADMINNNNNN");
    }
    else {
        return res.send(flag1);
    }
});

app.listen(8080);
