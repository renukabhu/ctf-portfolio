// app.py ported to run in the page (see emu/flask-lite.js). Same seed data,
// same checks, same raw SQL, on a real SQLite database (sql.js).
import { Flask, request, render_template, redirect, url_for, session, Response, text, sqlite, secret, run } from "../../emu/flask-lite.js";

const app = Flask();

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SECRET_KEY'] = 'among-us'

const db = await sqlite();

function database_init() {
    db.run(`CREATE TABLE user (
        id INTEGER NOT NULL,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(100) NOT NULL,
        flags_ordered JSON NOT NULL,
        PRIMARY KEY (id),
        UNIQUE (username)
    )`);
    const User = (username, password, flags_ordered) =>
        db.run("INSERT INTO user (username, password, flags_ordered) VALUES (?, ?, ?)", [username, password, JSON.stringify(flags_ordered)]);

    User('alpha', 'skibidi', ["brainrot flag"]);
    User('Cyber', secret("MxYREV82PQMwIBtyKhsfAywwRA0rKQAGK2YHGwcwJxxMHStPMDcdSTYtHxpMK3oMGBwwPRtaNi0fGiw/QwYDLyEcA3JTXQ=="), [self.__ENV.CHALLENGE_FLAG]);
    User('Savannah', 'cats123', ["Pride Flag", "Among Us Flag"]);
    User('Ronak', 'uwuowo', []);
    User('Renuka', 'Fortnite4Life', ["Fornite Flag"]);
    User('bliutech', 'Seaside_Lover', ["Chaewon American Flag"]);
}

app.route('/', { methods: ['GET', 'POST'] })(async function home() {
    if (request.method == 'POST') {
        let username = request.form['username']
        username = username.toUpperCase()
        let password = request.form['password']
        password = password.toUpperCase()

        if (username.includes("'"))
            return new Response("Invalid username: single quote characters are not allowed.", 400)

        // Totally secure code right here!
        const query = text(`SELECT * FROM user WHERE username = '${username}' AND password = '${password}'`)
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

database_init()
run()
