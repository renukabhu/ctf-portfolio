// app.py ported to run in the page (see emu/flask-lite.js). Same seed data,
// same checks, same raw SQL, on a real PostgreSQL database (PGlite), so the
// E'' escape-string trick works exactly as it did against the postgres container.
import { Flask, request, render_template, redirect, url_for, session, Response, text, postgres, secret, run } from "../../emu/flask-lite.js";

const app = Flask();

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql+psycopg2://uwu:secret@db:5432/users'
app.config['SECRET_KEY'] = 'among-us'

// wait for db to start :lemonthink:
const db = await postgres();

async function database_init() {
    try {
        await db.exec(`CREATE TABLE "user" (
            id SERIAL NOT NULL,
            username VARCHAR(100) NOT NULL,
            password VARCHAR(100) NOT NULL,
            flags_ordered JSON NOT NULL,
            PRIMARY KEY (id),
            UNIQUE (username)
        )`);
        const User = (username, password, flags_ordered) =>
            db.run('INSERT INTO "user" (username, password, flags_ordered) VALUES ($1, $2, $3)', [username, password, JSON.stringify(flags_ordered)]);

        await User('alpha', 'skibidi', ["brainrot flag"]);
        await User('Cyber', secret("MxYREV82PQMwIBtyKhsfAywwRA0rKQAGK2YHGwcwJxxMHStPMDcdSTYtHxpMK3oMGBwwPRtaNi0fGiw/QwYDLyEcA3JTXQ=="), [self.__ENV.CHALLENGE_FLAG]);
        await User('Savannah', 'cats123', ["Pride Flag", "Among Us Flag"]);
        await User('Ronak', 'uwuowo', []);
        await User('Renuka', 'Fortnite4Life', ["Fornite Flag"]);
        await User('bliutech', 'Seaside_Lover', ["Chaewon American Flag"]);
    } catch (e) {
        console.log("stinki dinki")
    }
}

app.route('/', { methods: ['GET', 'POST'] })(async function home() {
    if (request.method == 'POST') {
        const username = request.form['username']
        const password = request.form['password']

        if (username.includes("'"))
            return new Response("Invalid username: single quote characters are not allowed.", 400)
        if (password.includes("'"))
            return new Response("Invalid password: single quote characters are not allowed.", 400)

        // Totally secure code right here!
        // I wonder what that E character before the equals sign does
        const query = text(`SELECT * FROM "user" WHERE username = E'${username}' AND password = E'${password}'`)
        const user = await db.fetchone(query)

        if (user) {
            session['user_id'] = user.id
            return redirect(url_for('orders'))
        } else {
            return new Response("Sorry! This username and password combination is not a registered account :/", 401)
        }
    }
    return render_template('index.html')
});

app.route('/orders')(async function orders() {
    const user_id = session['user_id']
    if (!user_id)
        return redirect(url_for('login'))

    const user = await db.get('user', user_id)
    if (!user)
        return redirect(url_for('login'))

    return render_template('orders.html', { username: user.username, flags: user.flags_ordered })
});

await database_init()
run()
