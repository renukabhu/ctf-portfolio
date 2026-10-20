import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.post("/send", (req, res) => {
    if (!req.body.isPostOfficer || req.body.isPostOfficer != "true"){
        return res.send("Access denied: you appear not to be a post officer.");
    }
    else {
        return res.sendFile(__dirname + "/flag.txt");
    }
});

app.listen(8080, ()=> {
    console.log("Server started...");
});
